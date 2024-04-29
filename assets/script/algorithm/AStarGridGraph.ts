/*
 * @Author: hyrm 
 * @Date: 2024-04-29 22:47:35 
 * @Last Modified by: hyrm
 * @Last Modified time: 2024-04-30 00:04:28
 */
import { GraphMatrix } from "../dataStructure/Graph"
import { MinHeap, HeapItem } from "../dataStructure/Heap"


enum BlockType {
    BLOCK = 0,
    WALL = 1,
    PATH = 2,
    END = 3,
}

export class Block implements HeapItem {
    public f: number
    public g: number
    public h: number

    public x: number
    public y: number

    public type: BlockType
    public parent: Block

    public value: number = 0

    constructor(x: number, y: number, type: BlockType) {
        this.x = x
        this.y = y
        this.type = type
    }
}

export class AStarGridMesh {

    private blocks: Array<Array<Block>> = []

    private blockWidth: number
    private blockHeight: number

    private mapWidth: number
    private mapHeight: number

    private openList: MinHeap<Block>
    private openListMap: Map<number, Block> = new Map()
    private closeListMap: Map<number, Block> = new Map()

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

        // 初始化,清理上次寻路开启、关闭列表
        this.openList = new MinHeap<Block>([])
        this.openListMap = new Map<number, Block>()
        this.closeListMap = new Map<number, Block>()


        const endBlock = this.getBlockByPos(endPos)
        const startBlock = this.getBlockByPos(startPos)

        // 循环寻找 targetBlock 周围的8个其他 block,首次从 startBlock 开始
        let curSeekBlock = startBlock

        while (true) {

            const startBlockNeighbors = this.getNeighbors(curSeekBlock)

            // 计算f,g,h值
            for (const block of startBlockNeighbors) {

                if (!block || block.type === BlockType.WALL || this.openListMap.has(block.value) || this.closeListMap.has(block.value)) {
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

                this.openList.push(block)
                this.openListMap.set(block.value, block)
            }

            // 开启列表为空，没有通过路径
            if (this.openList.size === 0) return []

            // 从 openList 中找到 f 值最小的 block,放入 closeList，并从 openList 中删除，并设置为 targetBlock
            curSeekBlock = this.openList.pop()
            this.closeListMap.set(curSeekBlock.value, curSeekBlock)

            if (curSeekBlock === endBlock) {

                // 回溯路径
                const path: Array<Block> = []
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

    public getPosByBlock(block: Block): cc.Vec2 {
        const x = block.x * this.blockWidth - this.mapWidth / 2
        const y = block.y * this.blockHeight - this.mapHeight / 2
        return new cc.Vec2(x, y)
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
    public hasBarrier(startBlock: Block, endBlock: Block) {

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
            
            const loopStart = Math.min(startBlock.x, endBlock.x)
            const loopEnd = Math.max(startBlock.x, endBlock.x)
            for (let i = loopStart; i <= loopEnd; i += blockWidth) {
                if (i == loopStart) i += blockWidth / 2


                if (i == loopEnd + blockWidth / 2) i -= blockWidth / 2
            }
        } else {
            const loopStart = Math.min(startBlock.y, endBlock.y)
            const loopEnd = Math.max(startBlock.y, endBlock.y)

            for (let i = loopStart; i <= loopEnd; i += blockHeight) {
                if (i == loopStart) i += blockHeight / 2


                if (i == loopEnd + blockHeight / 2) i -= blockHeight / 2
            }
        }

    }


}




export type MapData = {
    mapWidth: number,
    mapHeight: number,
    nodeWidth: number,
    nodeHeight: number,
    roadDataArr: number[][],
}