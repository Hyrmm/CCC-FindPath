/*
 * @Author: hyrm 
 * @Date: 2024-04-27 17:10:42 
 * @Last Modified by: hyrm
 * @Last Modified time: 2024-04-30 18:25:21
 */

const { ccclass, property } = cc._decorator
import earcut from "earcut"
import { QuadTree, QuadTreeObject, QuadTreeRect } from './script/dataStructure/QuadTree'
import { AStarGraph, Triangle } from './script/algorithm/AStarGraph'
import { flatVertexs2Vec2, getCommonVertexs } from './script/utils/Utils'
import { Entity } from './script/components/EntityContainer'
import EntityContainer from './script/components/EntityContainer'
import { AStarGridMesh, MapData, Block } from "./script/algorithm/AStarGridMesh"
@ccclass
export default class Main extends cc.Component {

    @property(cc.Node)
    viewPort: cc.Node = null

    @property(cc.Node)
    mapContainer: cc.Node = null

    @property(cc.Node)
    entityContainer: cc.Node = null

    @property(cc.Node)
    graphicsContainer: cc.Node = null

    @property(cc.Node)
    entity_start: cc.Node = null

    @property(cc.Node)
    entity_end: cc.Node = null

    graphics_path: cc.Graphics = null
    graphics_mesh: cc.Graphics = null

    private entityContainerCom: EntityContainer

    private isTouching: boolean = false
    private mapQuadTree: QuadTree<tileMapData> = null
    private mapQuadSize: number = 16

    private mapOriSize: { width: number, height: number } = { width: 1024 * 7, height: 1024 * 4 }
    private mapTileSize: { width: number, height: number } = { width: 1024 * 7 / 16, height: 1024 * 4 / 16 }

    private astarGridhMesh: AStarGridMesh = null


    protected start() {
        this.entityContainerCom = this.entityContainer.getComponent(EntityContainer)

        this.graphics_path = this.graphicsContainer.getChildByName("path_graphics").getComponent(cc.Graphics)
        this.graphics_mesh = this.graphicsContainer.getChildByName("mesh_graphics").getComponent(cc.Graphics)

        console.time("init")
        // 地图触摸相关事件监听
        this.initTouchEventListener()
        console.timeEnd("init")

        console.time("QuadTree")
        // 四叉树初始化(用于动态加载可视区域显示地图)
        this.initTileMapQuadTree()
        console.timeEnd("QuadTree")

        console.time("meshGraph")
        // 寻路网格初始化(用于寻路算法)
        this.initAStarGridMesh()
        console.timeEnd("meshGraph")

        // 首次地图可视范围更新
        this.updateViewPortMapTileNodes()



    }



    private initTouchEventListener() {
        this.viewPort.on(cc.Node.EventType.TOUCH_MOVE, (event: cc.Event.EventTouch) => {
            if (!this.isTouching) return

            const delta = event.touch.getDelta()

            // 边界判断,因项目适配宽度,不同设备高度不同,这里取屏幕高度做判断
            const changePosY = this.mapContainer.y + delta.y
            const changePosX = this.mapContainer.x + delta.x

            if (Math.abs(changePosX) <= this.mapOriSize.width / 2 - this.viewPort.width / 2) {
                this.mapContainer.x = changePosX
                this.entityContainer.x = changePosX
                this.graphicsContainer.x = changePosX
            }

            if (Math.abs(changePosY) <= this.mapOriSize.height / 2 - this.viewPort.height / 2) {
                this.mapContainer.y = changePosY
                this.entityContainer.y = changePosY
                this.graphicsContainer.y = changePosY
            }

            this.updateViewPortMapTileNodes()

        }, this)

        this.viewPort.on(cc.Node.EventType.TOUCH_START, (event: cc.Event.EventTouch) => {
            this.isTouching = true

            const mapPos = this.mapContainer.convertToNodeSpaceAR(event.getLocation())
            const blockPos = this.astarGridhMesh.getBlockByPos(mapPos)
            const entityPos = this.entity_start.getPosition()

            this.node.getChildByName("fixed").getChildByName("lbl_pos").getComponent(cc.Label).string = `(${Math.ceil(mapPos.x)},${Math.ceil(mapPos.y)})\n(${blockPos.x},${blockPos.y})`

            console.time("gridMesh")
            const result = this.astarGridhMesh.findPath(entityPos, cc.v2(Math.ceil(mapPos.x), Math.ceil(mapPos.y)))
            console.timeEnd("gridMesh")
            this.drawRect(this.graphics_path, result)

        }, this)

        this.viewPort.on(cc.Node.EventType.TOUCH_END, (event: cc.Event.EventTouch) => {
            this.isTouching = false
        }, this)

        this.viewPort.on(cc.Node.EventType.TOUCH_CANCEL, (event: cc.Event.EventTouch) => {
            this.isTouching = false
        }, this)
    }

    private initTileMapQuadTree() {

        const boundsPosX = -this.mapOriSize.width / 2
        const boundsPosY = -this.mapOriSize.height / 2
        const boundsWidth = this.mapOriSize.width
        const boundsHeight = this.mapOriSize.height

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
            this.mapContainer.addChild(tileNode)

            // 建立基于世界坐标碰撞矩形
            const tileBoundsX = this.mapQuadTree.bounds.x + (cols - 1) * this.mapTileSize.width
            const tileBoundsY = this.mapQuadTree.bounds.y + (this.mapQuadSize - 1 - (rows - 1)) * this.mapTileSize.height
            const tileRect: QuadTreeRect = { x: tileBoundsX, y: tileBoundsY, width: this.mapTileSize.width, height: this.mapTileSize.height }
            const quadTreeObject: tileMapData = { owningRect: tileRect, node: tileNode }

            // 绑定碰撞矩形和地图块节点插入四叉树中
            this.mapQuadTree.insert(tileRect, quadTreeObject)
        }
    }

    private initAStarGridMesh() {
        cc.resources.load("mapData", cc.JsonAsset, (err, data) => {
            const astarGraph = new AStarGridMesh(data.json as MapData)
            this.astarGridhMesh = astarGraph
            const ctx = this.graphics_mesh

            ctx.strokeColor = cc.color(0, 0, 0, 100)
            // rows
            for (let i = 1; i < this.mapOriSize.height / 32; i++) {
                const startPos = cc.v2(0 - this.mapOriSize.width / 2, i * 32 - this.mapOriSize.height / 2)
                const endPos = cc.v2(this.mapOriSize.width - this.mapOriSize.width / 2, i * 32 - this.mapOriSize.height / 2)

                ctx.moveTo(startPos.x, startPos.y)
                ctx.lineTo(endPos.x, endPos.y)
                ctx.stroke()
            }

            // lines
            for (let i = 1; i < this.mapOriSize.width / 32; i++) {
                const startPos = cc.v2(i * 32 - this.mapOriSize.width / 2, 0 - this.mapOriSize.height / 2)
                const endPos = cc.v2(i * 32 - this.mapOriSize.width / 2, this.mapOriSize.height - this.mapOriSize.height / 2)

                ctx.moveTo(startPos.x, startPos.y)
                ctx.lineTo(endPos.x, endPos.y)
                ctx.stroke()

            }


            // for (const block of astarGraph.getAllBlocks()) {

            // }
        })
    }

    private updateViewPortMapTileNodes() {

        // 计算视口矩形
        const viewportBoundX = (0 - this.viewPort.width / 2) - this.mapContainer.x
        const viewportBoundY = (0 - this.viewPort.height / 2) - this.mapContainer.y
        const viewportRect: QuadTreeRect = { x: viewportBoundX, y: viewportBoundY, width: this.viewPort.width, height: this.viewPort.height }

        // 判断视口与地图四叉树碰撞
        const visiableTileObjects: tileMapData[] = this.mapQuadTree.retrieve(viewportRect)

        // 动态显示可视区域地图块节点
        this.mapContainer.children.forEach((node: cc.Node) => node.active = false)

        for (const tileObject of visiableTileObjects) {
            tileObject.node.active = true
            if (tileObject.node.getComponent(cc.Sprite)) continue

            cc.resources.load(tileObject.node.name, cc.SpriteFrame, (err, spriteFrame) => {
                tileObject.node.addComponent(cc.Sprite).spriteFrame = spriteFrame
            })
        }
    }

    private drawRect(ctx: cc.Graphics, blocks: Array<Block>, color: cc.Color = cc.Color.GREEN) {
        ctx.clear()
        for (const block of blocks) {
            const pos = this.astarGridhMesh.getPosByBlock(block)
            ctx.rect(pos.x, pos.y, 32, 32)
        }
        ctx.lineWidth = 5
        ctx.strokeColor = color
        ctx.stroke()
    }

    private drawLine(ctx: cc.Graphics, points: Array<cc.Vec2>, color: cc.Color = cc.Color.BLACK) {

        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y)
        }
        ctx.lineWidth = 5
        ctx.strokeColor = color
        ctx.stroke()
    }

    private drawTriangle(ctx: cc.Graphics, triangle: Triangle, color: cc.Color = cc.Color.RED) {
        const vertice1 = triangle.vertices[0]
        const vertice2 = triangle.vertices[1]
        const vertice3 = triangle.vertices[2]
        ctx.moveTo(vertice1.x, vertice1.y)
        ctx.lineTo(vertice2.x, vertice2.y)
        ctx.lineTo(vertice3.x, vertice3.y)
        ctx.lineTo(vertice1.x, vertice1.y)
        ctx.lineWidth = 5
        ctx.strokeColor = color
        ctx.stroke()
    }
}

type tileMapData = {
    owningRect: QuadTreeRect,
    node: cc.Node
}

