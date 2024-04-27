/*
 * @Author: hyrm 
 * @Date: 2024-04-27 16:25:24 
 * @Last Modified by:   hyrm 
 * @Last Modified time: 2024-04-27 16:25:24 
 */

// 基于邻接举证实现
export class GraphMatrix<T> {

    private matrix: Array<T[]> = []
    private vertices: Array<number> = []

    /* 构造函数 */
    constructor(vertices: number[] = [], edges: Array<T> = []) {

        // 添加顶点
        for (const val of vertices) {
            this.addVertex(val)
        }

        // 添加边
        for (const e of edges) {
            this.addEdge(e[0], e[1])
        }
    }

    /**
     * 添加顶点
     * @param val 
     */
    public addVertex(val: number): void {
        const size = this.size()

        // 向顶点列表中添加新顶点的值
        this.vertices.push(val)

        // 在邻接矩阵中添加一行
        const newRow: T[] = []
        for (let j = 0; j < size; j++) {
            newRow.push(null)
        }
        this.matrix.push(newRow)

        // 在邻接矩阵中添加一列
        for (const row of this.matrix) {
            row.push(null)
        }
    }

    /**
     * 删除顶点
     * @param index 
     */
    public removeVertex(index: number): void {
        if (index >= this.size()) {
            throw new RangeError('Index Out Of Bounds Exception')
        }
        // 在顶点列表中移除索引 index 的顶点
        this.vertices.splice(index, 1)

        // 在邻接矩阵中删除索引 index 的行
        this.matrix.splice(index, 1)
        // 在邻接矩阵中删除索引 index 的列
        for (const row of this.matrix) {
            row.splice(index, 1)
        }
    }

    /**
     * 添加边
     * @param i 
     * @param j 
     * @param weight 
     */
    public addEdge(i: number, j: number, edge: T = null): void {
        // 索引越界与相等处理
        if (i < 0 || j < 0 || i >= this.size() || j >= this.size() || i === j) {
            throw new RangeError('Index Out Of Bounds Exception')
        }
        // 在无向图中，邻接矩阵关于主对角线对称，即满足 (i, j) === (j, i)
        this.matrix[i][j] = edge
        this.matrix[j][i] = edge
    }

    /**
     * 删除边
     * @param i 
     * @param j 
     */
    public removeEdge(i: number, j: number): void {
        // 索引越界与相等处理
        if (i < 0 || j < 0 || i >= this.size() || j >= this.size() || i === j) {
            throw new Error('索引越界或相等')
        }
        this.matrix[i][j] = null
        this.matrix[j][i] = null
    }

    /**
     * 获取边
     * @param i 
     * @param j 
     */

    public getEdge(i: number, j: number): T {
        // 索引越界与相等处理
        if (i < 0 || j < 0 || i >= this.size() || j >= this.size() || i === j) {
            throw new Error('索引越界或相等')
        }
        return this.matrix[i][j]
    }

    /**
     * 获取顶点 i 的邻居
     * @param i 
     */
    public getNeighbors(i: number): Array<number> {
        const neighbors: Array<number> = []
        for (let j = 0; j < this.size(); j++) {
            if (this.matrix[i][j]) {
                neighbors.push(j)
            }
        }
        return neighbors
    }

    /* 打印邻接矩阵 */
    public print(): void {
        console.log('顶点列表 = ', this.vertices)
        console.log('邻接矩阵 =', this.matrix)
    }

    /* 获取顶点数量 */
    public size(): number {
        return this.vertices.length;
    }
}