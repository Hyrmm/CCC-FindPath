/*
 * @Author: hyrm 
 * @Date: 2024-04-27 17:10:20 
 * @Last Modified by:   hyrm 
 * @Last Modified time: 2024-04-27 17:10:20 
 */

class Heap<T> {
    protected heap: Array<T> = []

    /**
    * 获取左子节点的索引
    * @param i 节点索引
    * @returns 
    */
    protected left(i: number): number {
        return 2 * i + 1
    }

    /**
     * 获取右子节点的索引
     * @param i 节点索引
     * @returns 
     */
    protected right(i: number): number {
        return 2 * i + 2
    }

    /**
     * 获取父节点的索引
     * @param i 节点索引
     * @returns 
     */
    protected parent(i: number): number {
        return Math.floor((i - 1) / 2)
    }

    /**
     * 交换两个节点
     * @param i 节点索引
     * @param j 节点索引
     */
    protected swap(i: number, j: number): void {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]]
    }

    protected siftUp(i: number): void { }
    protected siftDown(i: number): void { }


    /**
     * 堆大小
     */
    public get size(): number {
        return this.heap.length
    }

    /**
     * 元素出堆
     */
    public pop(): T | undefined {
        // 与堆底元素交换位置
        this.swap(0, this.size - 1)

        const returnItem = this.heap.pop()

        // 从顶部到底堆化
        this.siftDown(0)

        return returnItem
    }

    /**
     * 元素入堆
     * @param val 元素
     */
    public push(val: T): void {
        // 入堆
        this.heap.push(val)
        // 堆化
        this.siftUp(this.size - 1)
    }

    /**
     * 返回堆顶元素
     * @returns
     */
    public peek(): T {
        return this.heap[0]
    }

    /**
     * 以数组的形式返回所有堆元素
     * @returns
     */
    public toArray(): Array<T> {
        return this.heap
    }

    constructor(items: Array<T>) {
        // 俩种方式建堆

        // 1. 依次对每个元素执行入堆操作, 时间复杂度 O(nlogn),遍历元素(n)*入堆(logn)
        // for (const item of items) {
        //     this.push(item)
        // }

        // 2. 一次性入堆,从底部层序便利对每个节点向下堆化,这样每层会形成一个已堆化的子树,时间复杂度 O(n)
        this.heap = items ? items : []
        for (let i = this.parent(this.size - 1); i >= 0; i--) {
            this.siftDown(i)
        }
    }
}




export interface HeapItem {
    value: number
}


// 大顶堆
export class MaxHeap<T extends HeapItem> extends Heap<T>{
    /**
     *  从底部到顶部堆化
     * @param i 节点索引
     */
    protected siftUp(i: number): void {
        while (true) {
            const p = this.parent(i)

            // 当“越过根节点”或“节点无须修复”时，结束堆化
            if (p < 0 || this.heap[i].value <= this.heap[p].value) break

            this.swap(i, p);
            i = p
        }
    }

    /**
    *  从顶部到顶部堆化
    * @param i 节点索引
    */
    protected siftDown(i: number): void {
        while (true) {
            let maxIndex = i

            // 取左右字数中较大的节点
            const leftIndex = this.left(i)
            const rightIndex = this.right(i)

            if (leftIndex < this.size && this.heap[leftIndex].value > this.heap[maxIndex].value) {
                maxIndex = leftIndex
            }

            if (rightIndex < this.size && this.heap[rightIndex].value > this.heap[maxIndex].value) {
                maxIndex = rightIndex
            }

            // 当较大节点索引等于当前节点索引时，结束堆化
            if (maxIndex === i) break


            this.swap(i, maxIndex)

            // 下一轮堆化
            i = maxIndex
        }
    }
}

// 小顶堆
export class MinHeap<T extends HeapItem> extends Heap<T>{

    /**
    *  从底部到顶部堆化
    * @param i 节点索引
    */
    protected siftUp(i: number): void {
        while (true) {
            const p = this.parent(i)

            // 当“越过根节点”或“节点无须修复”时，结束堆化
            if (p < 0 || this.heap[i].value >= this.heap[p].value) break

            this.swap(i, p);
            i = p
        }
    }

    /**
    *  从顶部到顶部堆化
    * @param i 节点索引
    */
    protected siftDown(i: number): void {
        while (true) {
            let maxIndex = i

            // 取左右字数中较大的节点
            const leftIndex = this.left(i)
            const rightIndex = this.right(i)

            if (leftIndex < this.size && this.heap[leftIndex].value < this.heap[maxIndex].value) {
                maxIndex = leftIndex
            }

            if (rightIndex < this.size && this.heap[rightIndex].value < this.heap[maxIndex].value) {
                maxIndex = rightIndex
            }

            // 当较大节点索引等于当前节点索引时，结束堆化
            if (maxIndex === i) break


            this.swap(i, maxIndex)

            // 下一轮堆化
            i = maxIndex
        }
    }
}


