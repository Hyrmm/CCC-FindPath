import { QuadTree, QuadTreeRect } from "../dataStructure/QuadTree";

const { ccclass, property } = cc._decorator;

@ccclass
export default class MapContainer extends cc.Component {

    private mapQuadTree: QuadTree<tileMapData> = null
    private mapQuadSize: number = 16
    private mapTileSize: { width: number, height: number } = { width: 448, height: 256 }

    start() {

    }

    public initMapQuadTree(mapOriSize: { width: number, height: number }) {
        const boundsPosX = -mapOriSize.width / 2
        const boundsPosY = -mapOriSize.height / 2
        const boundsWidth = mapOriSize.width
        const boundsHeight = mapOriSize.height

        const halfTileWidth = this.mapTileSize.width / 2
        const halfTileHeight = this.mapTileSize.height / 2

        const rootBounds: QuadTreeRect = { x: boundsPosX, y: boundsPosY, width: boundsWidth, height: boundsHeight }
        this.mapQuadTree = new QuadTree<tileMapData>(rootBounds, 4)

        for (let i = 0; i < Math.pow(this.mapQuadSize, 2); i++) {

            const rows = Math.floor(i / this.mapQuadSize) + 1
            const cols = i % this.mapQuadSize + 1

            // 建立基于地图节点相对地图块坐标
            const tileNode = new cc.Node(`tile_${i}`)
            const tilePosX = -mapOriSize.width / 2 + (cols - 1) * this.mapTileSize.width + halfTileWidth
            const tilePosY = -mapOriSize.height / 2 + (this.mapQuadSize - rows) * this.mapTileSize.height + halfTileHeight
            tileNode.setPosition(tilePosX, tilePosY)
            tileNode.setAnchorPoint(0.5, 0.5)
            this.node.addChild(tileNode)

            // 建立基于世界坐标碰撞矩形
            const tileBoundsX = this.mapQuadTree.bounds.x + (cols - 1) * this.mapTileSize.width
            const tileBoundsY = this.mapQuadTree.bounds.y + (this.mapQuadSize - 1 - (rows - 1)) * this.mapTileSize.height
            const tileRect: QuadTreeRect = { x: tileBoundsX, y: tileBoundsY, width: this.mapTileSize.width, height: this.mapTileSize.height }
            const quadTreeObject: tileMapData = { owningRect: tileRect, node: tileNode }

            // 绑定碰撞矩形和地图块节点插入四叉树中
            this.mapQuadTree.insert(tileRect, quadTreeObject)
        }
    }

    public retrieve(rect: QuadTreeRect) {
        return this.mapQuadTree.retrieve(rect)
    }

    public updateVisableTiles(rect: QuadTreeRect) {
        // 判断视口与地图四叉树碰撞
        const visiableTileObjects: tileMapData[] = this.mapQuadTree.retrieve(rect)

        // 动态显示可视区域地图块节点
        this.node.children.forEach((node: cc.Node) => node.active = false)

        for (const tileObject of visiableTileObjects) {
            tileObject.node.active = true
            if (tileObject.node.getComponent(cc.Sprite)) continue

            cc.resources.load(tileObject.node.name, cc.SpriteFrame, (err, spriteFrame) => {
                tileObject.node.addComponent(cc.Sprite).spriteFrame = spriteFrame
            })
        }
    }


}

type tileMapData = {
    owningRect: QuadTreeRect,
    node: cc.Node
}
