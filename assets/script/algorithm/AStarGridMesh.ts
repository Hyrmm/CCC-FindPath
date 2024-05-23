/*
 * @Author: hyrm 
 * @Date: 2024-05-11 14:43:54 
 * @Last Modified by: hyrm
 * @Last Modified time: 2024-05-21 09:43:12
 */
import { MinHeap, HeapItem } from "../dataStructure/Heap"
import { getLineFunc } from "../utils/Utils"


export enum BlockType {
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


export class AStarGridMesh {

    private static instance: AStarGridMesh

    static getInstance(): AStarGridMesh {
        if (!AStarGridMesh.instance) AStarGridMesh.instance = new AStarGridMesh()
        return AStarGridMesh.instance
    }

    private blocks: Array<Array<Block>> = []

    private mapWidth: number
    private mapHeight: number
    private blockWidth: number
    private blockHeight: number

    private openListMap: Map<Block, Block> = new Map()
    private openListHeap: MinHeap<Block> = new MinHeap<Block>([])
    private closeListMap: Map<Block, Block> = new Map()

    public reset(mapData: MapData): AStarGridMesh {
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

        return this
    }

    /**
     * 寻路入口
     * @param startPos 
     * @param endPos 
     * @param progress 
     * @returns 
     */
    public findPath(startPos: cc.Vec2, endPos: cc.Vec2, progress: (block: Block) => void = null): { path: Array<Block>, smoothPath: Array<Block>, collinearPath: Array<Block> } {
        console.time("FindPath")
        let endBlock = this.getBlockByPos(endPos)
        let startBlock = this.getBlockByPos(startPos)


        if (endBlock.type !== BlockType.BLOCK) {
            endBlock = this.getReplacedBlock(endBlock)
        }

        if (endBlock.type !== BlockType.BLOCK) {
            console.timeEnd("FindPath")
            return { path: [], smoothPath: [], collinearPath: [] }
        }

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
                // 寻路记录点
                if (progress) progress(block)

            }

            // 开启列表为空，没有通过路径
            if (this.openListHeap.size === 0) {
                console.timeEnd("FindPath")
                return { path: [], smoothPath: [], collinearPath: [] }
            }

            // 从 openList 中找到 f 值最小的 block,放入 closeList，并从 openList 中删除，并设置为 targetBlock
            curSeekBlock = this.openListHeap.pop()
            this.closeListMap.set(curSeekBlock, curSeekBlock)

            if (curSeekBlock === endBlock) {

                // 回溯路径
                const path: Array<Block> = []
                let curRecallBlock = curSeekBlock

                while (curRecallBlock !== startBlock) {
                    path.push(curRecallBlock)
                    curRecallBlock = curRecallBlock.parent
                }


                const smoothPath = this.smoothingPath([startBlock].concat(path.concat().reverse()))

                console.timeEnd("FindPath")
                return { path: path, smoothPath: smoothPath.smoothRes, collinearPath: smoothPath.collinearRes }
            }
        }
    }

    /**
    * 获取block 的8个邻域block(可优化，可根据目标节点方位调整为5个邻域),从左上角开始顺时针排列
    * @param block 
    * @returns
    */
    public getNeighbors(block: Block): Array<Block> {
        const left = this.blocks[block.y][block.x - 1]
        const right = this.blocks[block.y][block.x + 1]
        const top = this.blocks[block.y + 1] ? this.blocks[block.y + 1][block.x] : undefined
        const bottom = this.blocks[block.y - 1] ? this.blocks[block.y - 1][block.x] : undefined

        const leftTop = this.blocks[block.y - 1] ? this.blocks[block.y + 1][block.x - 1] : undefined
        const rightTop = this.blocks[block.y + 1] ? this.blocks[block.y + 1][block.x + 1] : undefined
        const leftBottom = this.blocks[block.y - 1] ? this.blocks[block.y - 1][block.x - 1] : undefined
        const rightBottom = this.blocks[block.y - 1] ? this.blocks[block.y - 1][block.x + 1] : undefined

        return [leftTop, rightTop, leftBottom, rightBottom, top, left, right, bottom]
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

        // 注意:向下取整，点共享多个block时，默认归属上或右的block
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
            result[1] = this.blocks[blockY][blockX - 1]
        }
        else if (!xIsInt && yIsInt) {
            // 上下俩点共享
            result[0] = this.blocks[blockY][blockX]
            result[1] = this.blocks[blockY - 1][blockX]
        }
        else {
            // 单点共享
            result[0] = this.blocks[blockY][blockX]
        }

        return result
    }

    /**
     * 获取可通过的替代block
     * @param block 
     * @returns 
     */
    public getReplacedBlock(block: Block): Block {
        let maxDepth = 10
        let result: Block = block
        for (let dep = 1; dep <= maxDepth; dep++) {

            // 左
            const l = this.blocks[block.y][block.x - dep]
            if (l && l.type === BlockType.BLOCK) return l

            // 右
            const r = this.blocks[block.y][block.x + dep]
            if (r && r.type === BlockType.BLOCK) return r

            // 上
            const t = this.blocks[block.y + dep] ? this.blocks[block.y + dep][block.x] : null
            if (t && t.type === BlockType.BLOCK) return t

            // 下
            const b = this.blocks[block.y - dep] ? this.blocks[block.y - dep][block.x] : null
            if (b && b.type === BlockType.BLOCK) return b

            // 左上
            const lt = this.blocks[block.y + dep] ? this.blocks[block.y + dep][block.x - dep] : null
            if (lt && lt.type === BlockType.BLOCK) return lt

            // 右上
            const rt = this.blocks[block.y + dep] ? this.blocks[block.y + dep][block.x + dep] : null
            if (rt && rt.type === BlockType.BLOCK) return rt

            // 左下
            const lb = this.blocks[block.y - dep] ? this.blocks[block.y - dep][block.x - dep] : null
            if (lb && lb.type === BlockType.BLOCK) return lb

            // 右下
            const rb = this.blocks[block.y - dep] ? this.blocks[block.y - dep][block.x + dep] : null
            if (rb && rb.type === BlockType.BLOCK) return rb
        }

        return result

    }

    /**
    * 计算启发函数值:曼哈顿距离、欧几里得距离、对角线距离
    * @param block1 
    * @param block2 
    * @returns 
    */
    private static calcHeuristicDistance(block1: Block, block2: Block): number {

        //曼哈顿距离
        // return Math.abs(block1.x - block2.x) + Math.abs(block1.y - block2.y)

        // 欧几里得距离
        return Math.sqrt((block1.x - block2.x) ** 2 + (block1.y - block2.y) ** 2)

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
     * @param startBlock 
     * @param endBlock 
     * @returns 
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

    /**
     * 路径平滑处理，合并共线点，去除拐点
     * @param path 路径点数组
     */
    public smoothingPath(path: Array<Block>): { collinearRes: Array<Block>, smoothRes: Array<Block> } {
        let len

        // 合并共线点
        const collinearRes: Array<Block> = path.concat()
        len = collinearRes.length

        if (len > 2) {
            let vector1 = cc.v2(collinearRes[len - 1].x, collinearRes[len - 1].y).sub(cc.v2(collinearRes[len - 2].x, collinearRes[len - 2].y))
            for (let i = len - 3; i >= 0; i--) {
                const vector2 = cc.v2(collinearRes[i + 1].x, collinearRes[i + 1].y).sub(cc.v2(collinearRes[i].x, collinearRes[i].y))

                if (vector1.cross(vector2) == 0) {
                    collinearRes.splice(i + 1, 1)
                } else {
                    vector1 = vector2
                }

            }
        }

        // 去除拐点
        len = collinearRes.length
        const smoothRes: Array<Block> = [collinearRes[len - 1]]
        let i = len - 1

        while (i > 0) {
            let flag = false
            let curBlock = collinearRes[i]
            for (let j = 0; j <= i - 1; j++) {

                if (!this.hasBarrier(curBlock, collinearRes[j])) {
                    smoothRes.push(collinearRes[j])
                    i = j
                    flag = true
                    break
                }

            }

            if (!flag) i--
            if (!flag && i != len - 1) smoothRes.push(collinearRes[i])
        }

        return { collinearRes: collinearRes, smoothRes: smoothRes }
    }

    public get allBlocks(): Array<Block> {
        return this.blocks.reduce((acc, curr) => acc.concat(curr), [])
    }
}




