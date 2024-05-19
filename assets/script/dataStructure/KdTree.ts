/*
 * @Author: hyrm 
 * @Date: 2024-05-20 00:28:15 
 * @Last Modified by:   hyrm 
 * @Last Modified time: 2024-05-20 00:28:15 
 */
type Point = Array<number>


export class KdTree {

    private axis: number
    private data: Point
    private left: KdTree | null
    private right: KdTree | null

    constructor(data: Point, left: KdTree, right: KdTree, axis: number) {
        this.axis = axis
        this.data = data
        this.left = left
        this.right = right
    }

    public serach2Leaf(point: Point): Array<KdTree> {
        const result: Array<KdTree> = []

        let current: KdTree | null = this
        while (current) {
            result.push(current)
            if (point[current.axis] < current.data[current.axis]) {
                current = current.left
            } else {
                current = current.right
            }
        }

        return result
    }

    public searchNearest(point: Point): Point | null {

        let stack: Array<KdTree> = this.serach2Leaf(point)

        let nearestPoint = stack[stack.length - 1].data
        let nearestDistance = KdTree.distance(point, stack[stack.length - 1].data)

        //回溯
        while (stack.length) {

            const current: KdTree = stack.pop()
            const currentDistance = KdTree.distance(point, current.data)
            nearestPoint = currentDistance < nearestDistance? current.data : nearestPoint
            nearestDistance = currentDistance < nearestDistance ? currentDistance : nearestDistance

            // 与超平面分割线相交
            if (Math.abs(point[current.axis] - current.data[current.axis]) < nearestDistance) {

                // 左子树|右子树是否加入回溯栈
                let next: KdTree | null
                if (point[current.axis] < current.data[current.axis]) {
                    next = current.right
                } else {
                    next = current.left
                }

                if (next) stack = stack.concat(next.serach2Leaf(point))
            }

        }

        return nearestPoint
    }


    static build(points: Array<Point>, axis: number = 0, k: number = 2): KdTree | null {
        if (points.length === 0) return null

        points = KdTree.sortByAxis(points, axis)

        const midIndex = Math.floor(points.length / 2)
        const leftPoints = points.slice(0, midIndex)
        const rightPoints = points.slice(midIndex + 1)

        return new KdTree(points[midIndex], KdTree.build(leftPoints, (axis + 1) % k), KdTree.build(rightPoints, (axis + 1) % k), axis)

    }

    /**
     * 俩点之间距离
     * @param a 
     * @param b 
     * @returns 
     */
    static distance(a: Point, b: Point): number {
        return Math.sqrt(a.reduce((acc, cur, index) => acc + (cur - b[index]) ** 2, 0))
    }

    /**
     * 按照给定维度对点集排序
     * @param points 点集
     * @param axis 维度
     * @returns 
     */
    static sortByAxis(points: Array<Point>, axis: number): Array<Point> {
        return points.sort((a, b) => a[axis] - b[axis])
    }

}