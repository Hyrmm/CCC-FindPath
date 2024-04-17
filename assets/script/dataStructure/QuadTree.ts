export class QuadTreeNode<T>{

    public static minAreaSize: [number, number] = [448, 512]

    private data: Array<T> | null
    private bounds: [number, number, number, number]
    private children: Array<QuadTreeNode<T>>

    constructor(bounds: [number, number, number, number], data: Array<T> | null = null) {
        this.data = data
        this.bounds = bounds
        this.children = []
    }

    /**
     * 节点递归分割,当前停止分割条件以最小节点大小
     * @returns 
     */
    subdivide(): void {
        const [xmin, ymin, xmax, ymax] = this.bounds

        // 分割边界判断
        const width = Math.abs(xmax - xmin)
        const height = Math.abs(ymax - ymin)
        if (width / 2 < QuadTreeNode.minAreaSize[0] || height / 2 < QuadTreeNode.minAreaSize[1]) return

        const xmid = (xmin + xmax) / 2
        const ymid = (ymin + ymax) / 2

        const quadData = this.splitData2Quad(this.data ? this.data : [])

        this.children.push(new QuadTreeNode<T>([xmin, ymin, xmid, ymid], quadData[0]))
        this.children.push(new QuadTreeNode<T>([xmid, ymin, xmax, ymid], quadData[1]))
        this.children.push(new QuadTreeNode<T>([xmin, ymid, xmid, ymax], quadData[2]))
        this.children.push(new QuadTreeNode<T>([xmid, ymid, xmax, ymax], quadData[3]))

        for (const child of this.children) {
            child.subdivide()
        }
    }

    insert(data: T, bounds: [number, number, number, number]): void {
        // if (!this.intersects(bounds)) {
        //     return
        // }

        // // 如果没有子节点，则将数据插入当前节点
        // if (this.children.length === 0) {
        //     this.data = data
        // } else {
        //     // 如果有子节点，则递归插入到合适的子节点
        //     for (const child of this.children) {
        //         child.insert(data, bounds)
        //     }
        // }
    }

    // 检查节点范围是否与给定范围相交
    intersects(bounds: [number, number, number, number]): boolean {
        const [xmin, ymin, xmax, ymax] = this.bounds
        const [bxmin, bymin, bxmax, bymax] = bounds

        return !(bxmax < xmin || bymax < ymin || bxmin > xmax || bymin > ymax)
    }

    // // 查询视口范围内的节点数据
    // query(viewport: [number, number, number, number]): Array<T> {
    //     const results: Array<T> = []

    //     if (!this.intersects(viewport)) {
    //         return results;
    //     }

    //     if (this.data) {
    //         results.push(this.data)
    //     }

    //     for (const child of this.children) {
    //         results.push(...child.query(viewport));
    //     }

    //     return results
    // }

    /**
     * 将给定节点数据分割为四份同长度节点数据，不足 null 补充
     * @param data 节点数据
     * @returns 
     */
    private splitData2Quad(data: Array<T>): Array<T[]> {

        // 数据不足,空补充
        const residue = data.length != 0 ? data.length % 4 : 4
        if (residue !== 0) {
            data = data.concat(new Array(residue).fill(null))
        }

        const result: Array<T[]> = []
        const partLength = data.length / 4

        for (let i = 0; i < 4; i++) {
            const startIndex = i * partLength
            const endIndex = startIndex + partLength
            const part = data.slice(startIndex, endIndex)
            result.push(part)
        }

        return result
    }
}
