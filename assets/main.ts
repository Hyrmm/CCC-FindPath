const { ccclass, property } = cc._decorator
import { MapMgr } from './script/manager/MapMgr'
import { QuadTree } from './script/dataStructure/QuadTree'

@ccclass
export default class Main extends cc.Component {

    @property(cc.Node)
    viewPort: cc.Node = null

    @property(cc.Node)
    mapContainer: cc.Node = null

    @property(cc.Node)
    rolesContainer: cc.Node = null

    private isTouching: boolean = false
    private mapQuadTree: QuadTree<cc.Node> = null

    private mapTilSize: cc.Vec2 = cc.v2(1024, 1024)
    private mapOriSize: cc.Vec2 = cc.v2(1024 * 7, 1024 * 4)

    start() {

        this.viewPort.on(cc.Node.EventType.TOUCH_START, this.onViewPortTouchStart, this)
        this.viewPort.on(cc.Node.EventType.TOUCH_MOVE, this.onViewPortTouchMove, this)
        this.viewPort.on(cc.Node.EventType.TOUCH_END, this.onViewPortTouchEnd, this)
        this.viewPort.on(cc.Node.EventType.TOUCH_CANCEL, this.onViewPortTouchEnd, this)

        // 四叉树初始化
        const rootBounds: [number, number, number, number] = [-this.mapOriSize.x / 2, -this.mapOriSize.y / 2, this.mapOriSize.x / 2, this.mapOriSize.y / 2]
        const mapTileBoundsArr: Array<[number, number, number, number]> = new Array(this.mapContainer.children.length).fill([0, 0, 0, 0])
        for (const [index, bounds] of mapTileBoundsArr.entries()) {
            const tileNode = this.mapContainer.children[index]
            console.log(tileNode.x,tileNode.y)
            mapTileBoundsArr[index] = [tileNode.x, tileNode.y, tileNode.x, tileNode.y]
        }
        this.mapQuadTree = new QuadTree<cc.Node>(rootBounds, mapTileBoundsArr, this.mapContainer.children)

        // 首次地图可视范围更新
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

        // 判断视口与地图四叉树碰撞
        const visiableTileNodes = this.mapQuadTree.queryIntersectsData([centerPos.x - this.viewPort.width / 2, centerPos.y - this.viewPort.height / 2, centerPos.x + this.viewPort.width / 2, centerPos.y + this.viewPort.height / 2])

        for (const tileNode of this.mapContainer.children) {
            if (visiableTileNodes.includes(tileNode)) {
                tileNode.active = true
            } else {
                tileNode.active = false
            }
        }
    }
}
