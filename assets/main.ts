const { ccclass, property } = cc._decorator
import { MapMgr } from './script/manager/MapMgr'
import { QuadTreeNode } from './script/dataStructure/QuadTree'

@ccclass
export default class Main extends cc.Component {

    @property(cc.Node)
    viewPort: cc.Node = null

    @property(cc.Node)
    mapContainer: cc.Node = null

    @property(cc.Node)
    rolesContainer: cc.Node = null

    private isTouching: boolean = false

    private mapTilSize: cc.Vec2 = cc.v2(1024, 1024)
    private mapOriSize: cc.Vec2 = cc.v2(1024 * 7, 1024 * 4)

    start() {

        this.viewPort.on(cc.Node.EventType.TOUCH_START, this.onViewPortTouchStart, this)
        this.viewPort.on(cc.Node.EventType.TOUCH_MOVE, this.onViewPortTouchMove, this)
        this.viewPort.on(cc.Node.EventType.TOUCH_END, this.onViewPortTouchEnd, this)
        this.viewPort.on(cc.Node.EventType.TOUCH_CANCEL, this.onViewPortTouchEnd, this)

        // 四叉树根节点
        const bounds: [number, number, number, number] = [-this.mapOriSize.x / 2, -this.mapOriSize.y / 2, this.mapOriSize.x / 2, this.mapOriSize.y / 2]
        const rootNode = new QuadTreeNode<cc.Node>(bounds, this.mapContainer.children)

        rootNode.subdivide()
        this.updateViewPortMapTileNodes()
    }


    private onViewPortTouchStart(event: cc.Event.EventTouch) {
        this.isTouching = true
    }

    private onViewPortTouchMove(event: cc.Event.EventTouch) {

        if (!this.isTouching) return

        const delta = event.touch.getDelta()

        // 边界判断,因项目适配宽度,不同设备高度不同,这里取屏幕高度做判断
        const changePosY = this.mapContainer.y + delta.y
        const changePosX = this.mapContainer.x + delta.x

        if (Math.abs(changePosX) <= this.mapOriSize.x / 2 - this.viewPort.width / 2) {
            this.mapContainer.x = changePosX
        }

        if (Math.abs(changePosY) <= this.mapOriSize.y / 2 - this.viewPort.height / 2) {
            this.mapContainer.y = changePosY
        }


        this.updateViewPortMapTileNodes()
    }

    private onViewPortTouchEnd(event: cc.Event.EventTouch) {
        this.isTouching = false
    }

    private updateViewPortMapTileNodes() {

        // 计算 viewport 中心坐标点
        const centerPos = new cc.Vec2(-this.mapContainer.x, -this.mapContainer.y)
        


        const viewPortRect = this.viewPort.getBoundingBoxToWorld()
        const visiableMapTileNodes: Array<cc.Node> = []

        for (const tileNode of this.mapContainer.children) {
            const tileRect = tileNode.getBoundingBoxToWorld()

            if (tileRect.intersects(viewPortRect)) {
                visiableMapTileNodes.push(tileNode)
            }

        }

        for (const tileNode of this.mapContainer.children) {
            if (visiableMapTileNodes.includes(tileNode)) {
                tileNode.active = true
            } else {
                tileNode.active = false
            }
        }
    }
}
