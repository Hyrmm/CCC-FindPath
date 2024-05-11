import { ObjectPool } from "../dataStructure/ObjectPool";
import { QuadTree, QuadTreeRect } from "../dataStructure/QuadTree";

const { ccclass, property } = cc._decorator;

@ccclass
export default class FovContainer extends cc.Component {

    private fovQuadTree: QuadTree<FovTileData> = null
    private fovQuadSize: number = 128
    private fovTileSize: { width: number, height: number } = { width: 56, height: 32 }

    private fovTileNodesPool: ObjectPool<cc.Node> = new ObjectPool<cc.Node>(() => new cc.Node())


    start() {
    }

    public initFovQuadTree(mapOriSize: { width: number, height: number }) {
        const boundsPosX = -mapOriSize.width / 2
        const boundsPosY = -mapOriSize.height / 2
        const boundsWidth = mapOriSize.width
        const boundsHeight = mapOriSize.height

        const halfTileWidth = this.fovTileSize.width / 2
        const halfTileHeight = this.fovTileSize.height / 2

        const rootBounds: QuadTreeRect = { x: boundsPosX, y: boundsPosY, width: boundsWidth, height: boundsHeight }
        this.fovQuadTree = new QuadTree<FovTileData>(rootBounds, 4)

        for (let i = 0; i < Math.pow(this.fovQuadSize, 2); i++) {

            const rows = Math.floor(i / this.fovQuadSize) + 1
            const cols = i % this.fovQuadSize + 1

            // 建立基于世界坐标碰撞矩形
            const nodeX = -mapOriSize.width / 2 + (cols - 1) * this.fovTileSize.width + halfTileWidth
            const nodeY = -mapOriSize.height / 2 + (rows - 1) * this.fovTileSize.height + halfTileHeight
            const tileBoundsX = this.fovQuadTree.bounds.x + (cols - 1) * this.fovTileSize.width
            const tileBoundsY = this.fovQuadTree.bounds.y + (rows - 1) * this.fovTileSize.height
            const tileRect: QuadTreeRect = { x: tileBoundsX, y: tileBoundsY, width: this.fovTileSize.width, height: this.fovTileSize.height }
            const quadTreeObject: FovTileData = { id: i, owningRect: tileRect, node: null, value: 0, tilePos: { x: nodeX, y: nodeY }, unlock: false }

            // 绑定碰撞矩形和迷雾块节点插入四叉树中
            this.fovQuadTree.insert(tileRect, quadTreeObject)
        }

        // console.log(this.fovQuadTree)
    }

    public updateVisableTiles(rect: QuadTreeRect) {
        // const visibleFovTiles = this.fovQuadTree.retrieve(rect)

        // this.node.children.forEach((node) => this.fovTileNodesPool.put(node))
        // this.node.removeAllChildren(false)

        // for (const fovTile of visibleFovTiles) {
        //     let node: cc.Node

        //     if (this.fovTileNodesPool.size() > 0) {
        //         node = this.fovTileNodesPool.get()
        //     } else {
        //         node = new cc.Node(String(fovTile.id))
        //         node.setAnchorPoint(0.5, 0.5)
        //         node.addComponent(cc.Sprite).spriteFrame = this.fov_spriteFrames[fovTile.value]
        //         node.getComponent(cc.Sprite).sizeMode = cc.Sprite.SizeMode.CUSTOM
        //         node.width = this.fovTileSize.width
        //         node.height = this.fovTileSize.height
        //         node.opacity = 180
        //     }
        //     // node.getComponent(cc.Sprite).spriteFrame = this.fov_spriteFrames[fovTile.value]
        //     if (fovTile.unlock) node.opacity = 0
        //     node.setPosition(fovTile.tilePos.x, fovTile.tilePos.y)
        //     this.node.addChild(node)

        //     fovTile.node = node
        // }

    }
}

type FovTileData = {
    id: number,
    value: number,
    node: cc.Node,
    owningRect: QuadTreeRect,
    tilePos: { x: number, y: number },
    unlock: boolean
}
