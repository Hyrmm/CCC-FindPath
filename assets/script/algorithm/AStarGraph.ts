import { GraphMatrix } from "../dataStructure/Graph"

export type Triangle = {
    id: number
    vertices: Array<cc.Vec2>

    f?: number
    g?: number
    h?: number
    parent?: Triangle

}




export class AStarGraph {

    private graph: GraphMatrix
    private triangles: Array<Triangle>

    private openList: Array<Triangle> = []
    private closeList: Array<Triangle> = []

    constructor(graph: GraphMatrix, triangles: Array<Triangle>) {
        this.graph = graph
        this.triangles = triangles
    }


    public findTrianglePath(start: cc.Vec2, end: cc.Vec2): Array<Triangle> {

        const startTriangleId = this.getTriangleIdByPos(start)
        const endTriangleId = this.getTriangleIdByPos(end)

        if (startTriangleId === null || endTriangleId === null) throw new Error("起点或终点不在可行区域内")

        // 清理数据
        this.triangles[startTriangleId].parent = null
        this.triangles[startTriangleId].f = null
        this.triangles[startTriangleId].g = null
        this.triangles[startTriangleId].h = null

        this.openList = []
        this.closeList = [this.triangles[startTriangleId]]

        let currentTriangleId = startTriangleId
        while (true) {

            // 寻找临边三角形，并计算 f、g、h 值
            const neighborsTriangleIds = this.getNeighborsTriangle(currentTriangleId)
            for (const triangleId of neighborsTriangleIds) {

                const triangle = this.triangles[triangleId]

                if (this.openList.includes(this.triangles[triangleId]) || this.closeList.includes(this.triangles[triangleId])) continue

                triangle.parent = this.triangles[currentTriangleId]

                triangle.g = triangle.parent.g ? triangle.parent.g + 1 : 1
                triangle.h = AStarGraph.calcHeuristicDistance(triangle, this.triangles[endTriangleId])
                triangle.f = triangle.g + triangle.h * AStarGraph.calcDynamicWeight(triangle.g, triangle.h)


                this.openList.push(triangle)
            }

            // 开启列表排序
            this.openList.sort((a, b) => a.f - b.f)

            // 开启下一轮领边三角形搜索
            const nextTriangle = this.openList.shift()
            currentTriangleId = nextTriangle.id
            this.closeList.push(nextTriangle)

            // 找到终点三角形，结束搜索，回溯返回路径
            if (currentTriangleId === endTriangleId) {
                const path: Array<Triangle> = []
                let current = this.triangles[endTriangleId]
                while (current) {
                    path.push(current)
                    current = current.parent
                }
                return path.reverse()
            }

        }
    }

    public getTriangleByPos(pos: cc.Vec2): Triangle | null {
        const triangleId = this.getTriangleIdByPos(pos)
        return triangleId ? this.triangles[triangleId] : null
    }

    public getTriangleIdByPos(pos: cc.Vec2): number | null {

        for (const triangle of this.triangles) {
            const a = triangle.vertices[0]
            const b = triangle.vertices[1]
            const c = triangle.vertices[2]

            const AB_AP1 = b.sub(a).cross(pos.sub(a))
            const BC_BP1 = c.sub(b).cross(pos.sub(b))
            const CA_CP1 = a.sub(c).cross(pos.sub(c))

            if (AB_AP1 > 0 && BC_BP1 > 0 && CA_CP1 > 0) return triangle.id
        }

        return null
    }

    public getNeighborsTriangle(triangleId: number): Array<number> {
        return this.graph.getNeighbors(triangleId)
    }

    /**
    * 计算动态权值:主要控制最终估计代价更倾向于启发函数还是实际代价
    * @param g
    * @param h
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
    * 计算启发函数值:曼哈顿距离、欧几里得距离、对角线距离
    * @param triangle1 
    * @param triangle2 
    * @returns 
    */
    private static calcHeuristicDistance(triangle1: Triangle, triangle2: Triangle): number {
        //曼哈顿距离
        const random1 = this.getTriangInnerRandomPoint(triangle1)
        const random2 = this.getTriangInnerRandomPoint(triangle2)
        return Math.abs(random1.x - random2.x) + Math.abs(random1.y - random2.y)

        // 欧几里得距离
        // return Math.sqrt((block1.x - block2.x) ** 2 + (block1.y - block2.y) ** 2)

        // 对角线距离
        // return Math.max(Math.abs(block1.x - block2.x), Math.abs(block1.y - block2.y))
    }

    /**
     * 获取三角形内部随机点
     * @param triangle 
     * @returns 
     */
    private static getTriangInnerRandomPoint(triangle: Triangle): cc.Vec2 {
        const random1 = Math.random()
        const random2 = Math.random()

        const sqrtRandom1 = Math.sqrt(random1)

        const x = (1 - sqrtRandom1) * triangle.vertices[0].x + (sqrtRandom1 * (1 - random2)) * triangle.vertices[1].x + (sqrtRandom1 * random2) * triangle.vertices[2].x
        const y = (1 - sqrtRandom1) * triangle.vertices[1].y + (sqrtRandom1 * (1 - random2)) * triangle.vertices[1].y + (sqrtRandom1 * random2) * triangle.vertices[2].y

        return new cc.Vec2(x, y)
    }
}