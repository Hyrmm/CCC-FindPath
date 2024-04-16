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


export class AStarMgr {

    private static mapW: number
    private static mapH: number

    private static perBlockW: number
    private static perBlockH: number

    private static rows: number
    private static lines: number

    public static blocks: Array<Array<Block>> = []

    public static openList: Array<Block> = []
    public static closeList: Array<Block> = []

    /**
    * 初始化格子地图
    * @param w 
    * @param h 
    * @param mapData 
    */
    public static initMap(w: number, h: number, mapData: Array<number[]>) {

        this.mapW = w
        this.mapH = h

        this.rows = mapData.length
        this.lines = mapData[0].length

        this.perBlockH = h / this.rows
        this.perBlockW = w / this.lines

        this.blocks = []

        for (let row = 0; row < mapData.length; row++) {
            const rowArray: Array<Block> = []
            const rowData = mapData[row]

            for (let line = 0; line < rowData.length; line++) {
                rowArray.push(new Block(line, row, rowData[line]))
            }

            this.blocks.push(rowArray)
        }
        this.rows = this.blocks.length
        this.lines = this.blocks[0].length
    }

    /**
    * 寻路
    * @param startPos 开始地图局部坐标
    * @param endPos 结束地图局部坐标
    * @returns
    */
    public static findPath(startPos: cc.Vec2, endPos: cc.Vec2): Array<Block> {
        // 初始化,清理上次寻路开启、关闭列表
        this.openList = []
        this.closeList = []

        const startBlock = this.getBlockByPos(startPos)
        const endBlock = this.getBlockByPos(endPos)

        // 循环寻找 targetBlock 周围的8个其他 block,首次从 startBlock 开始
        let curStartBlock = startBlock

        while (true) {

            const startBlockNeighbors = this.getNeighbors(curStartBlock)

            // 计算f,g,h值
            for (const [directIndex, block] of startBlockNeighbors.entries()) {

                if (!block || block.type === BlockType.WALL || this.openList.includes(block) || this.closeList.includes(block)) {
                    continue
                }
                block.parent = curStartBlock

                const neighborG = block.parent.g ? block.parent.g : 0 + (directIndex % 2 == 0 ? 1.4 : 1)

                // 启发函数代价、以及动态权重值
                const heuristicDistance = this.calcHeuristicDistance(block, endBlock)
                const dynamicWeight = this.calcDynamicWeight(neighborG, heuristicDistance)
                const neighborH = heuristicDistance * dynamicWeight

                const neighborF = neighborG + neighborH

                block.f = neighborF
                block.g = neighborG
                block.h = neighborH

                this.openList.push(block)
            }

            // 从 openList 中找到 f 值最小的 block,放入 closeList，并从 openList 中删除，并设置为 targetBlock
            this.openList.sort((pre, next) => pre.f - next.f)
            curStartBlock = this.openList.shift()
            this.closeList.push(curStartBlock)

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
    private static getNeighbors(block: Block): Array<Block> {
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
    private static getBlockByPos(pos: cc.Vec2): Block {
        const x = Math.floor(pos.x / this.perBlockW)
        const y = Math.floor(pos.y / this.perBlockH)
        return this.blocks[y][x]
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