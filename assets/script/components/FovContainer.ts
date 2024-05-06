import { QuadTree, QuadTreeRect } from "../dataStructure/QuadTree";

const { ccclass, property } = cc._decorator;

@ccclass
export default class FovContainer extends cc.Component {

    @property([cc.SpriteFrame])
    fov_spriteFrames: Array<cc.SpriteFrame> = []

    private fovQuadTree: QuadTree<fovTileData> = null
    private mapQuadSize: number = 32
    private fovTileSize: { width: number, height: number } = { width: 224, height: 128 }

    private fovTileNodesPool: cc.NodePool


    start() {
    }

    protected onLoad(): void {
        this.fovTileNodesPool = new cc.NodePool()
    }

    public initFovQuadTree(mapOriSize: { width: number, height: number }) {
        const boundsPosX = -mapOriSize.width / 2
        const boundsPosY = -mapOriSize.height / 2
        const boundsWidth = mapOriSize.width
        const boundsHeight = mapOriSize.height

        const halfTileWidth = this.fovTileSize.width / 2
        const halfTileHeight = this.fovTileSize.height / 2
        const halfFovQuadSize = this.mapQuadSize / 2

        const rootBounds: QuadTreeRect = { x: boundsPosX, y: boundsPosY, width: boundsWidth, height: boundsHeight }
        this.fovQuadTree = new QuadTree<fovTileData>(rootBounds, 5)



        for (let i = 0; i < Math.pow(this.mapQuadSize, 2); i++) {

            const rows = Math.floor(i / this.mapQuadSize) + 1
            const cols = i % this.mapQuadSize + 1

            // 建立基于地图节点相对地图块坐标
            // const tileNode = new cc.Node(`tile_${i}`)


            const tilePosX = cols <= halfFovQuadSize ? -((halfFovQuadSize - cols) * this.fovTileSize.width + halfTileWidth) : (cols - (halfFovQuadSize + 1)) * this.fovTileSize.width + halfTileWidth
            const tilePosY = rows <= halfFovQuadSize ? (halfFovQuadSize - rows) * this.fovTileSize.height + halfTileHeight : -((rows - (halfFovQuadSize + 1)) * this.fovTileSize.height + halfTileHeight)
            // tileNode.setPosition(tilePosX, tilePosY)
            // tileNode.setAnchorPoint(0.5, 0.5)
            // tileNode.addComponent(cc.Sprite).spriteFrame = this.fov_spriteFrames[0]
            // tileNode.getComponent(cc.Sprite).sizeMode = cc.Sprite.SizeMode.CUSTOM
            // tileNode.width = this.fovTileSize.width
            // tileNode.height = this.fovTileSize.height
            // this.node.addChild(tileNode)

            // 建立基于世界坐标碰撞矩形
            const tileBoundsX = this.fovQuadTree.bounds.x + (cols - 1) * this.fovTileSize.width
            const tileBoundsY = this.fovQuadTree.bounds.y + (this.mapQuadSize - 1 - (rows - 1)) * this.fovTileSize.height
            const tileRect: QuadTreeRect = { x: tileBoundsX, y: tileBoundsY, width: this.fovTileSize.width, height: this.fovTileSize.height }
            const quadTreeObject: fovTileData = { owningRect: tileRect, node: null, fovVal: 0, preNodePos: { x: tilePosX, y: tilePosY } }



            // 绑定碰撞矩形和地图块节点插入四叉树中
            this.fovQuadTree.insert(tileRect, quadTreeObject)
        }

        console.log(this.fovQuadTree)
    }

    public retrieve(rect: QuadTreeRect) {
        const visibleTiles = this.fovQuadTree.retrieve(rect)

        this.node.children.forEach((node: cc.Node) => {
            node.active = false
            this.fovTileNodesPool.put(node)
        })

        for (const tile of visibleTiles) {
            if (tile.node) {
                tile.node.getComponent(cc.Sprite).spriteFrame = this.fov_spriteFrames[tile.fovVal]
                tile.node.active = true
                continue
            }

            if (this.fovTileNodesPool.size() > 0) {
                const node = this.fovTileNodesPool.get()
                tile.node = node
                node.setPosition(tile.preNodePos.x, tile.preNodePos.y)
                node.getComponent(cc.Sprite).spriteFrame = this.fov_spriteFrames[tile.fovVal]
            } else {
                const node = new cc.Node()
                tile.node = node

                node.width = this.fovTileSize.width
                node.height = this.fovTileSize.height
                node.setAnchorPoint(0.5, 0.5)
                node.setPosition(tile.preNodePos.x, tile.preNodePos.y)
                node.addComponent(cc.Sprite)
                node.getComponent(cc.Sprite).sizeMode = cc.Sprite.SizeMode.CUSTOM
                node.getComponent(cc.Sprite).spriteFrame = this.fov_spriteFrames[tile.fovVal]
                this.node.addChild(node)
            }

        }
        console.log(this.fovTileNodesPool.size())
        console.log(this.node.children.length)
        return this.fovQuadTree.retrieve(rect)
    }



}

type fovTileData = {
    owningRect: QuadTreeRect,
    preNodePos: { x: number, y: number },
    fovVal: number,
    node: cc.Node,
}
