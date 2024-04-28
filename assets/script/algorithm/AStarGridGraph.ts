import { GraphMatrix } from "../dataStructure/Graph"
import { MinHeap } from "../dataStructure/Heap"


enum BlockType {
    BLOCK = 0,
    WALL = 1,
    PATH = 2,
    END = 3,
}

export class Block {
    public f: number
    public g: number
    public h: number

    public x: number
    public y: number

    public type: BlockType
    public parent: Block

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

    private openList: Array<Block> = []
    private closeList: Map<Block, Block> = new Map()

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
        this.openList = []
        this.closeList = new Map()

        const startBlock = this.getBlockByPos(startPos)
        const endBlock = this.getBlockByPos(endPos)

        // 循环寻找 targetBlock 周围的8个其他 block,首次从 startBlock 开始
        let curStartBlock = startBlock

        while (true) {

            const startBlockNeighbors = this.getNeighbors(curStartBlock)

            // 计算f,g,h值
            for (const [directIndex, block] of startBlockNeighbors.entries()) {

                if (!block || block.type === BlockType.WALL || this.openList.includes(block) || this.closeList.has(block)) {
                    continue
                }
                block.parent = curStartBlock

                const neighborG = block.parent.g ? block.parent.g : 0 + (directIndex % 2 == 0 ? 1.4 : 1)

                // 启发函数代价、以及动态权重值
                const heuristicDistance = AStarGridMesh.calcHeuristicDistance(block, endBlock)
                const dynamicWeight = AStarGridMesh.calcDynamicWeight(neighborG, heuristicDistance)
                const neighborH = heuristicDistance * dynamicWeight

                const neighborF = neighborG + neighborH

                block.f = neighborF
                block.g = neighborG
                block.h = neighborH

                this.openList.push(block)
            }
            if (this.openList.length === 0) return []
            // 从 openList 中找到 f 值最小的 block,放入 closeList，并从 openList 中删除，并设置为 targetBlock
            this.openList.sort((pre, next) => pre.f - next.f)
            curStartBlock = this.openList.shift()
            this.closeList.set(curStartBlock, curStartBlock)

            if (curStartBlock === endBlock) {
                // 回溯路径
                const path: Array<Block> = []
                let currentBlock = curStartBlock

                while (currentBlock !== startBlock) {
                    path.push(currentBlock)
                    currentBlock = currentBlock.parent
                }
                path.push(currentBlock)
                path.reverse()
                return path
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


}




export type MapData = {
    mapWidth: number,
    mapHeight: number,
    nodeWidth: number,
    nodeHeight: number,
    roadDataArr: number[][],
}