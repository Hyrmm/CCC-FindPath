/*
 * @Author: hyrm 
 * @Date: 2024-04-27 16:25:51 
 * @Last Modified by:   hyrm 
 * @Last Modified time: 2024-04-27 16:25:51 
 */
const { ccclass, property } = cc._decorator
import { QuadTree, QuadTreeObject, QuadTreeRect } from './script/dataStructure/QuadTree'
import { GraphMatrix } from './script/dataStructure/Graph'
import { AStarGraph, Triangle } from './script/algorithm/AStarGraph'
import earcut from "earcut"
import { flatVertexs2Vec2, getCommonVertexs } from './script/utils/Utils'
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


    private isTouching: boolean = false
    private mapQuadTree: QuadTree<tileMapData> = null
    private mapQuadSize: number = 16

    private mapOriSize: { width: number, height: number } = { width: 1024 * 7, height: 1024 * 4 }
    private mapTileSize: { width: number, height: number } = { width: 1024 * 7 / 16, height: 1024 * 4 / 16 }


    private astarGraph: AStarGraph = null


    start() {
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
        this.initTriangleNavMeshGraph()
        console.timeEnd("meshGraph")

        // 首次地图可视范围更新
        this.updateViewPortMapTileNodes()

    }



    private initTouchEventListener() {
        let isPlacingEnd = false
        let isPlacingRole = false

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
            mapPos.x = Math.ceil(mapPos.x)
            mapPos.y = Math.ceil(mapPos.y)
            this.node.getChildByName("fixed").getChildByName("lbl_pos").getComponent(cc.Label).string = `(${mapPos.x.toFixed(2)}, ${mapPos.y.toFixed(2)})\n(triangle:${this.astarGraph.getTriangleIdByPos(mapPos)})`

            if (isPlacingEnd) isPlacingEnd = false
            if (isPlacingRole) isPlacingRole = false

        }, this)

        this.viewPort.on(cc.Node.EventType.TOUCH_END, (event: cc.Event.EventTouch) => {
            this.isTouching = false
        }, this)

        this.viewPort.on(cc.Node.EventType.TOUCH_CANCEL, (event: cc.Event.EventTouch) => {
            this.isTouching = false
        }, this)

        this.viewPort.on(cc.Node.EventType.MOUSE_MOVE, (event: cc.Event.EventMouse) => {
            const mapPos = this.mapContainer.convertToNodeSpaceAR(event.getLocation())

            if (isPlacingEnd) {
                this.entity_end.x = Math.ceil(mapPos.x)
                this.entity_end.y = Math.ceil(mapPos.y)
            }

            if (isPlacingRole) {
                this.entity_start.x = Math.ceil(mapPos.x)
                this.entity_start.y = Math.ceil(mapPos.y)
            }

        })

        this.entity_end.on(cc.Node.EventType.TOUCH_START, (event: cc.Event.EventTouch) => {
            if (isPlacingEnd) {
                const start = new cc.Vec2(this.entity_start.x, this.entity_start.y)
                const end = new cc.Vec2(this.entity_end.x, this.entity_end.y)

                const pathGraphics = this.graphicsContainer.getChildByName("path_graphics").getComponent(cc.Graphics)
                pathGraphics.clear()

                const path = this.astarGraph.findTrianglePath(start, end)
                for (const triangle of path.trianglesPath) {
                    this.drawTriangle(pathGraphics, triangle, cc.Color.GREEN)
                }
                path.pointsPath.unshift(start)
                path.pointsPath.push(end)
                this.drawLine(pathGraphics, path.pointsPath)
            }
            isPlacingEnd = !isPlacingEnd
        })

        this.entity_start.on(cc.Node.EventType.TOUCH_START, (event: cc.Event.EventTouch) => {
            isPlacingRole = !isPlacingRole
        })

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

    private initTriangleNavMeshGraph() {
        const polygonVerticesFlat = [-94, 474, 218, 457, 239, 203, 76, 66, -87, 76, -193, -94, -283, 261, -209, 594]
        const triangleVerticesIndexs = earcut(polygonVerticesFlat)
        this.astarGraph = new AStarGraph(flatVertexs2Vec2(polygonVerticesFlat), triangleVerticesIndexs)
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

    private drawLine(ctx: cc.Graphics, points: Array<cc.Vec2>) {

        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y)
        }
        ctx.lineWidth = 5
        ctx.strokeColor = cc.Color.BLACK
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

