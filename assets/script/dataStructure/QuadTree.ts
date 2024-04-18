class QuadTreeNode<T> {

    private data: T | null = null
    private dataName: string
    private bounds: [number, number, number, number]
    private children: Array<QuadTreeNode<T>>

    constructor(bounds: [number, number, number, number]) {
        this.bounds = bounds
        this.children = []
    }

    /**
     * 插入数据
     * @param data 数据
     * @param bounds 数据范围
     */
    public insert(data: T, bounds: [number, number, number, number]): boolean {

        // 判断地图块的坐标是否在当前节点的边界内
        if (!this.intersects(bounds)) return false

        // 若子节点为空,则直接绑定数据
        if (this.children.length == 0) {
            this.data = data
            return true
        }

        // 递归对子节点进行绑定数据
        for (const child of this.children) {
            const insertResult = child.insert(data, bounds)
            if (insertResult) return true
        }

        return false

    }

    /**
     * 节点递归分割,当前停止分割条件以最小节点大小
     * @returns 
     */
    public subdivide(divide: number): void {

        const [xmin, ymin, xmax, ymax] = this.bounds

        // 分割边界判断
        const width = Math.abs(xmax - xmin)
        const height = Math.abs(ymax - ymin)
        const minAreaSize = [width / divide, height / divide]
        if (width / 2 < minAreaSize[0] || height / 2 < minAreaSize[1]) return

        const xmid = (xmin + xmax) / 2
        const ymid = (ymin + ymax) / 2

        this.children.push(new QuadTreeNode<T>([xmin, ymin, xmid, ymid]))
        this.children.push(new QuadTreeNode<T>([xmid, ymin, xmax, ymid]))
        this.children.push(new QuadTreeNode<T>([xmin, ymid, xmid, ymax]))
        this.children.push(new QuadTreeNode<T>([xmid, ymid, xmax, ymax]))

        for (const child of this.children) {
            child.subdivide(divide / 2)
        }
    }

    /**
     * 判断节点是否与给定范围相交
     * @param bounds 查询范围
     * @returns 
     */
    public intersects(bounds: [number, number, number, number]): boolean {
        const [xmin, ymin, xmax, ymax] = this.bounds
        const [bxmin, bymin, bxmax, bymax] = bounds

        return !(bxmax < xmin || bymax < ymin || bxmin > xmax || bymin > ymax)
    }

    /**
     * 查找节点范围内的节点数据
     * @param bounds 查询范围
     * @returns 
     */
    public queryIntersectsData(bounds: [number, number, number, number]): Array<T> {
        const results: Array<T> = []

        if (!this.intersects(bounds)) {
            return results;
        }

        if (this.data) {
            results.push(this.data)
        }

        for (const child of this.children) {
            results.push(...child.queryIntersectsData(bounds))
        }

        return results
    }
}



export class QuadTree<T> {

    private root: QuadTreeNode<T>

    constructor(boundary: [number, number, number, number], splitSize: number, boundsArr: Array<[number, number, number, number]> = [], dataArr: Array<T> = []) {

        this.root = new QuadTreeNode<T>(boundary)

        this.root.subdivide(splitSize)

        for (const [index, bounds] of boundsArr.entries()) {
            this.root.insert(dataArr[index], bounds)
        }
    }

    public queryIntersectsData(bounds: [number, number, number, number]): Array<T> {
        return this.root.queryIntersectsData(bounds)
    }
}