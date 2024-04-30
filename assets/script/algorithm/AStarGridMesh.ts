/*
 * @Author: hyrm 
 * @Date: 2024-04-29 22:47:35 
 * @Last Modified by: hyrm
 * @Last Modified time: 2024-04-30 18:05:54
 */
import { GraphMatrix } from "../dataStructure/Graph"
import { MinHeap, HeapItem } from "../dataStructure/Heap"
import { getLineFunc } from "../utils/Utils"


enum BlockType {
    BLOCK = 0,
    WALL = 1,
    PATH = 2,
    END = 3,
}

export class Block implements HeapItem {
    public x: number
    public y: number

    public type: BlockType


    public value: number = 0

    public f: number
    public g: number
    public h: number
    public parent: Block

    constructor(x: number, y: number, type: BlockType) {
        this.x = x
        this.y = y
        this.type = type
    }
}

export class SeekBlock extends Block {
    public f: number
    public g: number
    public h: number
    public parent: SeekBlock
}


export class AStarGridMesh {

    private blocks: Array<Array<Block>> = []

    private blockWidth: number
    private blockHeight: number

    private mapWidth: number
    private mapHeight: number

    private openListMap: Map<Block, Block> = new Map()
    private openListHeap: MinHeap<SeekBlock> = new MinHeap<SeekBlock>([])
    private closeListMap: Map<Block, Block> = new Map()

    constructor(mapData: MapData) {
        // 构建格子地图
        for (let row = 0; row < mapData.roadDataArr.length; row++) {

            const rowData = mapData.roadDataArr[row]
            const rowArray: Array<Block> = []

            for (let line = 0; line < rowData.length; line++) {
                rowArray.push(new Block(line, row, rowData[line]))
            }

            this.blocks.push(rowArray)
        }

        this.mapWidth = mapData.mapWidth
        this.mapHeight = mapData.mapHeight

        this.blockWidth = mapData.nodeWidth
        this.blockHeight = mapData.nodeHeight

    }


    public findPath(startPos: cc.Vec2, endPos: cc.Vec2): Array<Block> {
        const endBlock = this.getBlockByPos(endPos)
        const startBlock = this.getBlockByPos(startPos)



        const hasB = this.hasBarrier(startBlock, endBlock)

        console.log("是否有障碍", hasB)

        // 初始化,清理上次寻路开启、关闭列表
        this.openListMap = new Map<Block, Block>()
        this.openListHeap = new MinHeap<Block>([])
        this.closeListMap = new Map<Block, Block>()


        // 循环寻找 curSeekBlock 周围的8个其他 block,首次从 startBlock 开始
        let curSeekBlock = startBlock

        while (true) {

            const startBlockNeighbors = this.getNeighbors(curSeekBlock)

            // 计算f,g,h值
            for (const block of startBlockNeighbors) {
                if (!block || block.type === BlockType.WALL || this.openListMap.has(block) || this.closeListMap.has(block)) {
                    continue
                }

                block.parent = curSeekBlock

                block.g = block.parent.g ? block.parent.g + 1 : 1

                // 启发函数代价、以及动态权重值
                const heuristicDistance = AStarGridMesh.calcHeuristicDistance(block, endBlock)
                const dynamicWeight = AStarGridMesh.calcDynamicWeight(block.g, heuristicDistance)

                block.h = heuristicDistance * dynamicWeight
                block.f = block.g + block.h

                block.value = block.f

                this.openListMap.set(block, block)
                this.openListHeap.push(block)

            }

            // 开启列表为空，没有通过路径
            if (this.openListHeap.size === 0) return []

            // 从 openList 中找到 f 值最小的 block,放入 closeList，并从 openList 中删除，并设置为 targetBlock
            curSeekBlock = this.openListHeap.pop()
            this.closeListMap.set(curSeekBlock, curSeekBlock)

            if (curSeekBlock === endBlock) {

                // 回溯路径
                const path: Array<SeekBlock> = []
                let curRecallBlock = curSeekBlock

                while (curRecallBlock !== startBlock) {
                    path.push(curRecallBlock)
                    curRecallBlock = curRecallBlock.parent
                }

                return path.reverse()
            }
        }
    }

    /**
    * 获取block 的8个邻域block(可优化，可根据目标节点方位调整为5个邻域),从左上角开始顺时针排列
    * @param block 
    * @returns
    */
    public getNeighbors(block: Block): Array<Block> {
        const leftTop = this.blocks[block.y - 1] ? this.blocks[block.y - 1][block.x - 1] : undefined
        const top = this.blocks[block.y + 1] ? this.blocks[block.y + 1][block.x] : undefined
        const rightTop = this.blocks[block.y + 1] ? this.blocks[block.y + 1][block.x + 1] : undefined

        const left = this.blocks[block.y][block.x - 1]
        const right = this.blocks[block.y][block.x + 1]

        const leftBottom = this.blocks[block.y - 1] ? this.blocks[block.y - 1][block.x - 1] : undefined
        const bottom = this.blocks[block.y - 1] ? this.blocks[block.y - 1][block.x] : undefined
        const rightBottom = this.blocks[block.y - 1] ? this.blocks[block.y - 1][block.x + 1] : undefined

        return [leftTop, top, rightTop, left, right, leftBottom, bottom, rightBottom]
    }

    /**
    * 通过坐标获取 block
    * @param pos 地图局部坐标
    * @returns 
    */
    public getBlockByPos(pos: cc.Vec2): Block {
        const x = this.mapWidth / 2 + pos.x
        const y = this.mapHeight / 2 + pos.y

        const blockX = Math.floor(x / this.blockWidth)
        const blockY = Math.floor(y / this.blockHeight)

        return this.blocks[blockY][blockX]
    }

    /**
     * 通过 block 获取block的左下角坐标
     * @param block 
     * @returns 
     */
    public getPosByBlock(block: Block): cc.Vec2 {
        const x = block.x * this.blockWidth - this.mapWidth / 2
        const y = block.y * this.blockHeight - this.mapHeight / 2
        return new cc.Vec2(x, y)
    }

    /**
    * 通过坐标获取 block，针对 block 边界点被多个 block 共享
    * @param pos 
    * @returns 
    */
    public getBlockByPosExt(pos: cc.Vec2): Array<Block> {
        const result: Array<Block> = []

        const blockX = Math.floor((this.mapWidth / 2 + pos.x) / this.blockWidth)
        const blockY = Math.floor((this.mapHeight / 2 + pos.y) / this.blockHeight)


        const xIsInt = pos.x % this.blockWidth == 0
        const yIsInt = pos.y % this.blockHeight == 0

        if (xIsInt && yIsInt) {
            // 四点共享
            result[0] = this.blocks[blockY - 1][blockX - 1]
            result[1] = this.blocks[blockY - 1][blockX]
            result[2] = this.blocks[blockY][blockX - 1]
            result[3] = this.blocks[blockY][blockX]
        }
        else if (xIsInt && !yIsInt) {
            // 左右俩点共享
            result[0] = this.blocks[blockY][blockX]
            result[1] = this.blocks[blockY][blockX + 1]
        }
        else if (!xIsInt && yIsInt) {
            // 上下俩点共享
            result[0] = this.blocks[blockY][blockX]
            result[1] = this.blocks[blockY + 1][blockX]
        }
        else {
            // 单点共享
            result[0] = this.blocks[blockY][blockX]
        }

        return result
    }

    public getAllBlocks(): Array<Block> {
        return this.blocks.flat()
    }

    /**
    * 计算启发函数值:曼哈顿距离、欧几里得距离、对角线距离
    * @param block1 
    * @param block2 
    * @returns 
    */
    private static calcHeuristicDistance(block1: Block, block2: Block): number {

        //曼哈顿距离
        return Math.abs(block1.x - block2.x) + Math.abs(block1.y - block2.y)

        // 欧几里得距离
        // return Math.sqrt((block1.x - block2.x) ** 2 + (block1.y - block2.y) ** 2)

        // 对角线距离
        // return Math.max(Math.abs(block1.x - block2.x), Math.abs(block1.y - block2.y))
    }

    /**
    * 计算动态权值:主要控制最终估计代价更倾向于启发函数还是实际代价
    * @param block 
    * @returns 
    */
    private static calcDynamicWeight(g: number, h: number): number {
        // 权重越大，启发函数值越大，更倾向于到达终点，搜索更小的范围
        // 权重越小，启发函数值越小，更倾向于最优路径，也就是采用代价值，搜索更大的范围
        if (h > 18) {
            return 1.4
        } else {
            return 0.8
        }
    }


    /**
     * 判断两节点之间是否存在障碍物 
     * 
     */
    public hasBarrier(startBlock: Block, endBlock: Block): boolean {

        const blockWidth = this.blockWidth
        const blockHeight = this.blockHeight

        const startX = this.getPosByBlock(startBlock).x + this.blockWidth / 2
        const startY = this.getPosByBlock(startBlock).y + this.blockHeight / 2
        const endX = this.getPosByBlock(endBlock).x + this.blockWidth / 2
        const endY = this.getPosByBlock(endBlock).y + this.blockHeight / 2

        const distX = Math.abs(endX - startX)
        const distY = Math.abs(endY - startY)
        const loopDirection = distX > distY ? true : false

        if (loopDirection) {
            const lineFunc = getLineFunc(cc.v2(startX, startY), cc.v2(endX, endY), 0)
            const loopStart = Math.min(startX, endX)
            const loopEnd = Math.max(startX, endX)

            for (let i = loopStart; i <= loopEnd; i += blockWidth) {
                if (i == loopStart) i += blockWidth / 2

                const yPos = lineFunc(i)
                const passedBlockList = this.getBlockByPosExt(cc.v2(i, yPos))
                for (const passBlock of passedBlockList) {
                    if (passBlock.type === BlockType.WALL) return true
                }


                if (i == loopEnd + blockWidth / 2) i -= blockWidth / 2
            }
        } else {
            const lineFunc = getLineFunc(cc.v2(startX, startY), cc.v2(endX, endY), 1)
            const loopStart = Math.min(startY, endY)
            const loopEnd = Math.max(startY, endY)

            for (let i = loopStart; i <= loopEnd; i += blockHeight) {
                if (i == loopStart) i += blockHeight / 2
                const xPos = lineFunc(i)
                const passedBlockList = this.getBlockByPosExt(cc.v2(xPos, i))
                for (const passBlock of passedBlockList) {
                    if (passBlock.type === BlockType.WALL) return true
                }

                if (i == loopEnd + blockHeight / 2) i -= blockHeight / 2
            }
        }

        return false

    }


}




export type MapData = {
    mapWidth: number,
    mapHeight: number,
    nodeWidth: number,
    nodeHeight: number,
    roadDataArr: number[][],
}