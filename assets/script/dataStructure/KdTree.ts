import { MaxHeap } from './Heap';
/*
 * @Author: hyrm 
 * @Date: 2024-05-20 00:28:15 
 * @Last Modified by: hyrm
 * @Last Modified time: 2024-05-20 17:24:04
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

    /**
     * 返回直到叶节点访问路径
     * @param point 
     * @returns 
     */
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

    /**
     * k-近邻搜索(k>=1),k=1即最近邻近点，取返回值下标0即可
     * @param point 目标点
     * @param k 近邻个数
     * @param maxHeap 大
     * @returns 
     */
    public searchKNearest(point: Point, k: number = 1, maxHeap?: MaxHeap<{ value: number, point: Point }>): Array<{ value: number, point: Point }> {

        // 初始化大顶堆，类top-k算法，维护一个节点数为k的最大堆
        if (!maxHeap) {
            maxHeap = new MaxHeap<{ value: number, point: Point }>([])
            for (let i = 0; i < k; i++) maxHeap.push({ value: Infinity, point: null })
        }

        let stack: Array<KdTree> = this.serach2Leaf(point)

        //叶节点路径回溯
        while (stack.length) {
            const topNearestDistance = maxHeap.peek().value

            const current: KdTree = stack.pop()
            const currentDistance = KdTree.distance(point, current.data)

            // 小于大顶堆顶，替换加入堆中
            if (currentDistance < topNearestDistance) {
                maxHeap.pop()
                maxHeap.push({ value: currentDistance, point: current.data })
            }

            // 判断与超平面分割线相交，子树加入搜索区间
            if (Math.abs(point[current.axis] - current.data[current.axis]) < topNearestDistance) {

                let next: KdTree | null
                if (point[current.axis] < current.data[current.axis]) {
                    next = current.right
                } else {
                    next = current.left
                }

                // 子树存在，加入回溯栈
                if (next) stack = stack.concat(next.serach2Leaf(point))
            }
        }

        return maxHeap.toArray()
    }

    /**
     * 构建k维树
     * @param points 点集
     * @param axis 切割轴(切割维度)
     * @param k 维度
     * @returns 
     */
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
     * @param axis 轴(维度)
     * @returns 
     */
    static sortByAxis(points: Array<Point>, axis: number): Array<Point> {
        return points.sort((a, b) => a[axis] - b[axis])
    }

}