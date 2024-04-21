const { ccclass, property } = cc._decorator
import { QuadTree, QuadTreeObject, QuadTreeRect } from './script/dataStructure/QuadTree'
import { AStarMgr } from './script/manager/AStarMgr'

@ccclass
export default class Main extends cc.Component {

    @property(cc.Node)
    viewPort: cc.Node = null

    @property(cc.Node)
    mapContainer: cc.Node = null

    @property(cc.Node)
    rolesContainer: cc.Node = null

    private isTouching: boolean = false
    private mapQuadTree: QuadTree<tileMapData> = null
    private mapQuadSize: number = 16

    private mapOriSize: { width: number, height: number } = { width: 1024 * 7, height: 1024 * 4 }
    private mapTileSize: { width: number, height: number } = { width: 1024 * 7 / 16, height: 1024 * 4 / 16 }

    start() {

        // 地图拖动事件监听
        this.viewPort.on(cc.Node.EventType.TOUCH_START, this.onViewPortTouchStart, this)
        this.viewPort.on(cc.Node.EventType.TOUCH_MOVE, this.onViewPortTouchMove, this)
        this.viewPort.on(cc.Node.EventType.TOUCH_END, this.onViewPortTouchEnd, this)
        this.viewPort.on(cc.Node.EventType.TOUCH_CANCEL, this.onViewPortTouchEnd, this)

        // 四叉树初始化(用于动态加载地图)
        const rootBounds: QuadTreeRect = { x: -this.mapOriSize.width / 2, y: -this.mapOriSize.height / 2, width: this.mapOriSize.width, height: this.mapOriSize.height }
        this.mapQuadTree = new QuadTree<tileMapData>(rootBounds, 4)
        for (let i = 0; i < Math.pow(this.mapQuadSize, 2); i++) {
            const rows = Math.floor(i / this.mapQuadSize)
            const cols = i % this.mapQuadSize
            const tilePosX = cols * this.mapTileSize.width
            const tilePosY = (15 - rows) * this.mapTileSize.height

            const tileNode = new cc.Node(`tile_${i}`)
            tileNode.setPosition(tilePosX, tilePosY)
            tileNode.setAnchorPoint(0, 0)
            this.mapContainer.addChild(tileNode)

            const tileBoundsX = this.mapQuadTree.bounds.x + cols * this.mapTileSize.width
            const tileBoundsY = this.mapQuadTree.bounds.y + (this.mapQuadSize - 1 - rows) * this.mapTileSize.height

            const tileRect: QuadTreeRect = { x: tileBoundsX, y: tileBoundsY, width: this.mapTileSize.width, height: this.mapTileSize.height }
            const quadTreeObject: tileMapData = { owningRect: tileRect, node: tileNode }

            this.mapQuadTree.insert(tileRect, quadTreeObject)

        }

        console.log('mapQuadTree', this.mapQuadTree)
        // 寻路网格初始化
        // const mapDataMatrix = new QuadTree<cc.Node>(rootBounds, 896, mapTileBoundsArr, this.mapContainer.children)


        // AStarMgr.initMap(this.mapOriSize.x, this.mapOriSize.y, mapDataMatrix)

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

        if (changePosX <= -this.viewPort.width / 2 && changePosX >= -this.mapOriSize.width + this.viewPort.width / 2) {
            this.mapContainer.x = changePosX
            this.rolesContainer.x = changePosX
        }

        if (changePosY <= -this.viewPort.height / 2 && changePosY >= -this.mapOriSize.height + this.viewPort.height / 2) {
            this.mapContainer.y = changePosY
            this.rolesContainer.y = changePosY
        }


        this.updateViewPortMapTileNodes()
    }

    private onViewPortTouchEnd(event: cc.Event.EventTouch) {
        this.isTouching = false
    }

    private updateViewPortMapTileNodes() {

        // 计算 viewport 中心坐标点
        const centerPos = new cc.Vec2(0 - (this.mapContainer.x + this.mapOriSize.width / 2), 0 - (this.mapContainer.y + this.mapOriSize.height / 2))

        // 判断视口与地图四叉树碰撞
        const viewportRect: QuadTreeRect = { x: centerPos.x - this.viewPort.width / 2, y: centerPos.y - this.viewPort.height / 2, width: this.viewPort.width, height: this.viewPort.height }
        const visiableTileObjects: tileMapData[] = this.mapQuadTree.retrieve(viewportRect)

        for (const tileObject of visiableTileObjects) {
            if (!tileObject.node.getComponent(cc.Sprite)) {
                tileObject.node.addComponent(cc.Sprite)
                cc.resources.load(tileObject.node.name, cc.SpriteFrame, (err, spriteFrame) => {
                    tileObject.node.getComponent(cc.Sprite).spriteFrame = spriteFrame
                })
            }
        }
    }
}

type tileMapData = {
    owningRect: QuadTreeRect,
    node: cc.Node
}
