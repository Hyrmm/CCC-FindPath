/*
 * @Author: hyrm 
 * @Date: 2024-04-27 17:10:47 
 * @Last Modified by:   hyrm 
 * @Last Modified time: 2024-04-27 17:10:47 
 */

export enum BoundaryType {
    LEFT_TOP,
    RIGHT_TOP,
    LEFT_BOTTOM,
    RIGHT_BOTTOM
}

export class QuadTree<T extends QuadTreeObject> {
    public bounds: QuadTreeRect

    private level: number = 0
    private max_levels: number = 16
    private max_objects: number = 10

    private objects: Array<T> = []
    private children: Array<QuadTree<T>> = []


    private dirStr: string = "root"
    /**
     * @param level 当前区域深度
     * @param bounds 当前区域包围盒范围
     * @param max_objects 当前区域存放的最大对象数量,超过该数量则分裂
     * @param max_levels 整个四叉树的最大深度,超过该深度则不再分裂
     */
    constructor(bounds: QuadTreeRect, max_objects: number, max_levels?: number, level?: number, dirStr?: string) {
        this.bounds = bounds
        this.dirStr = dirStr || this.dirStr
        this.level = level || this.level
        this.max_levels = max_levels || this.max_levels
        this.max_objects = max_objects || this.max_objects
    }

    /**
     * 插入数据对象到当前区域中
     * @param rect 矩形范围
     * @param obj 区域内的对象
     */
    public insert(rect: QuadTreeRect, obj: T) {

        // 如果有子节点，则插入到子节点中
        if (this.children.length) {
            const indexes = this.getBelongIndex(rect)
            for (const index of indexes) {
                this.children[index].insert(rect, obj)
            }
            return
        }


        // 如果没有子节点，则插入到当前节点中
        this.objects.push(obj)

        // 插入对象后，如果对象数量超过最大数量，则分裂
        if (this.objects.length >= this.max_objects && this.level < this.max_levels) {

            if (!this.children.length) {
                this.subdivide()
            }

            // 把原有对象分散插入到新分裂子节点中
            for (const obj of this.objects) {
                const indexes = this.getBelongIndex(obj.owningRect)
                for (const index of indexes) {
                    this.children[index].insert(obj.owningRect, obj)
                }
            }

            // 清空当前节点的对象
            this.objects = []
        }
    }

    /**
    * 分裂
    */
    public subdivide() {
        const subWidth = this.bounds.width / 2
        const subHeight = this.bounds.height / 2
        // 左上
        this.children[0] = new QuadTree({
            x: this.bounds.x,
            y: this.bounds.y + subHeight,
            width: subWidth,
            height: subHeight
        }, this.max_objects, this.max_levels, this.level + 1, "左上")


        // 右上
        this.children[1] = new QuadTree({
            x: this.bounds.x + subWidth,
            y: this.bounds.y + subHeight,
            width: subWidth,
            height: subHeight
        }, this.max_objects, this.max_levels, this.level + 1, "右上")

        // 左下
        this.children[2] = new QuadTree({
            x: this.bounds.x,
            y: this.bounds.y,
            width: subWidth,
            height: subHeight
        }, this.max_objects, this.max_levels, this.level + 1, "坐下")

        // 右下
        this.children[3] = new QuadTree({
            x: this.bounds.x + subWidth,
            y: this.bounds.y,
            width: subWidth,
            height: subHeight
        }, this.max_objects, this.max_levels, this.level + 1, "右下")
    }

    /**
     * 查询所有与矩形范围重叠内的对象 
     * @param rect 矩形范围
     */
    public retrieve(rect: QuadTreeRect): Array<T> {

        let returnObjects = this.objects
        const indexes = this.getBelongIndex(rect)

        // 如果有子节点，则递归查找
        if (this.children.length) {
            for (const index of indexes) {
                returnObjects = returnObjects.concat(this.children[index].retrieve(rect))
            }
        }

        // 对象可能存在重叠，所以需要去重
        returnObjects = returnObjects.filter((item, index) => returnObjects.indexOf(item) >= index)

        return returnObjects
    }

    /**
     * 获取矩形所属的节点索引
     * @param rect 矩形范围
     * @returns 节点索引数组
     */
    public getBelongIndex(rect: QuadTreeRect): Array<number> {
        
        // 可能同时与多个节点重叠，所以返回多个节点的索引
        const indexes: Array<number> = []

        const boundMidX = this.bounds.x + (this.bounds.width / 2)
        const boundMidY = this.bounds.y + (this.bounds.height / 2)

        const startIsInTop = rect.y >= boundMidY
        const startIsInLeft = rect.x < boundMidX

        const endIsinBottom = rect.y + rect.height <= boundMidY
        const endIsInRight = rect.x + rect.width > boundMidX

        // 左下
        if (startIsInLeft && !startIsInTop) {
            indexes.push(2)
        }

        // 右上
        if (endIsInRight && !endIsinBottom) {
            indexes.push(1)
        }

        // 左上
        if (startIsInLeft && !endIsinBottom) {
            indexes.push(0)
        }

        // 右下
        if (!startIsInTop && endIsInRight) {
            indexes.push(3)
        }



        return indexes
    }

}

export type QuadTreeRect = {
    x: number,
    y: number,
    width: number,
    height: number
}

export type QuadTreeObject = {
    owningRect: QuadTreeRect,
}






