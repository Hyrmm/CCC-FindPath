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

        const rootBounds: QuadTreeRect = { x: boundsPosX, y: boundsPosY, width: boundsWidth, height: boundsHeight }
        this.mapQuadTree = new QuadTree<tileMapData>(rootBounds, 4)

        for (let i = 0; i < Math.pow(this.mapQuadSize, 2); i++) {

            const rows = Math.floor(i / this.mapQuadSize) + 1
            const cols = i % this.mapQuadSize + 1

            // 建立基于地图节点相对地图块坐标
            const tileNode = new cc.Node(`tile_${i}`)
            const halfTileWidth = this.mapTileSize.width / 2
            const halfTileHeight = this.mapTileSize.height / 2
            const tilePosX = cols <= this.mapQuadSize / 2 ? -((this.mapQuadSize / 2 - cols) * this.mapTileSize.width + halfTileWidth) : (cols - (this.mapQuadSize / 2 + 1)) * this.mapTileSize.width + halfTileWidth
            const tilePosY = rows <= this.mapQuadSize / 2 ? (this.mapQuadSize / 2 - rows) * this.mapTileSize.height + halfTileHeight : -((rows - (this.mapQuadSize / 2 + 1)) * this.mapTileSize.height + halfTileHeight)
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

}

type tileMapData = {
    owningRect: QuadTreeRect,
    node: cc.Node
}
