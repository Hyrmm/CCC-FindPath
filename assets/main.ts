/*
 * @Author: hyrm 
 * @Date: 2024-04-27 17:10:42 
 * @Last Modified by: hyrm
 * @Last Modified time: 2024-04-27 22:09:43
 */

const { ccclass, property } = cc._decorator
import earcut from "earcut"
import { QuadTree, QuadTreeObject, QuadTreeRect } from './script/dataStructure/QuadTree'
import { AStarGraph, Triangle } from './script/algorithm/AStarGraph'
import { flatVertexs2Vec2, getCommonVertexs } from './script/utils/Utils'
import { Entity } from './script/components/EntityContainer'
import EntityContainer from './script/components/EntityContainer'
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

    private entityContainerCom: EntityContainer

    private isTouching: boolean = false
    private mapQuadTree: QuadTree<tileMapData> = null
    private mapQuadSize: number = 16

    private mapOriSize: { width: number, height: number } = { width: 1024 * 7, height: 1024 * 4 }
    private mapTileSize: { width: number, height: number } = { width: 1024 * 7 / 16, height: 1024 * 4 / 16 }


    private astarGraph: AStarGraph = null


    protected start() {
        this.entityContainerCom = this.entityContainer.getComponent(EntityContainer)

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

                this.entityContainerCom.addShadowPos(this.entity_start.name, path.pointsPath.concat([end]))

                path.pointsPath.push(end)
                path.pointsPath.unshift(start)
                this.drawLine(pathGraphics, path.pointsPath)

                this.drawLine(pathGraphics, path.apexPath, cc.Color.BLUE)


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
        const polygonVerticesFlat = [
            -2849,
            -511,
            -2849,
            -511,
            -2849,
            -511,
            -3191,
            -460,
            -3191,
            -460,
            -3191,
            -460,
            -3053,
            -592,
            -3053,
            -592,
            -3053,
            -592,
            -3236,
            -658,
            -3236,
            -658,
            -3236,
            -658,
            -3341,
            -643,
            -3341,
            -643,
            -3341,
            -643,
            -3428,
            -697,
            -3428,
            -697,
            -3428,
            -697,
            -3572,
            -769,
            -3572,
            -769,
            -3572,
            -769,
            -3572,
            -880,
            -3572,
            -880,
            -3572,
            -880,
            -3380,
            -811,
            -3380,
            -811,
            -3380,
            -811,
            -3287,
            -805,
            -3287,
            -805,
            -3287,
            -805,
            -3263,
            -883,
            -3263,
            -883,
            -3263,
            -883,
            -3563,
            -1006,
            -3563,
            -1006,
            -3563,
            -1006,
            -3551,
            -1093,
            -3551,
            -1093,
            -3551,
            -1093,
            -3164,
            -979,
            -3164,
            -979,
            -3164,
            -979,
            -3011,
            -925,
            -3011,
            -925,
            -3011,
            -925,
            -2771,
            -910,
            -2771,
            -910,
            -2771,
            -910,
            -2627,
            -832,
            -2627,
            -832,
            -2627,
            -832,
            -2336,
            -739,
            -2336,
            -739,
            -2336,
            -739,
            -1892,
            -754,
            -1892,
            -754,
            -1892,
            -754,
            -1811,
            -880,
            -1811,
            -880,
            -1811,
            -880,
            -1658,
            -865,
            -1658,
            -865,
            -1658,
            -865,
            -1631,
            -775,
            -1631,
            -775,
            -1631,
            -775,
            -1331,
            -883,
            -1331,
            -883,
            -1331,
            -883,
            -1196,
            -868,
            -1196,
            -868,
            -1196,
            -868,
            -1169,
            -1021,
            -1169,
            -1021,
            -1169,
            -1021,
            -1040,
            -1123,
            -1040,
            -1123,
            -1040,
            -1123,
            -950,
            -994,
            -950,
            -994,
            -950,
            -994,
            -782,
            -970,
            -782,
            -970,
            -782,
            -970,
            -482,
            -952,
            -482,
            -952,
            -482,
            -952,
            154,
            -991,
            154,
            -991,
            154,
            -991,
            613,
            -844,
            613,
            -844,
            613,
            -844,
            1060,
            -1129,
            1060,
            -1129,
            1060,
            -1129,
            1717,
            -1351,
            1717,
            -1351,
            1717,
            -1351,
            2248,
            -1252,
            2248,
            -1252,
            2248,
            -1252,
            2851,
            -1399,
            2851,
            -1399,
            2851,
            -1399,
            3151,
            -1519,
            3151,
            -1519,
            3151,
            -1519,
            3391,
            -1423,
            3391,
            -1423,
            3391,
            -1423,
            3568,
            -1273,
            3568,
            -1273,
            3568,
            -1273,
            3556,
            -973,
            3556,
            -973,
            3556,
            -973,
            3331,
            -940,
            3331,
            -940,
            3331,
            -940,
            3211,
            -475,
            3211,
            -475,
            3211,
            -475,
            3004,
            -307,
            3004,
            -307,
            3004,
            -307,
            2773,
            -280,
            2773,
            -280,
            2773,
            -280,
            2623,
            -49,
            2623,
            -49,
            2623,
            -49,
            2179,
            248,
            2179,
            248,
            2179,
            248,
            1720,
            563,
            1720,
            563,
            1720,
            563,
            1759,
            649,
            1759,
            649,
            1759,
            649,
            1909,
            714,
            1909,
            714,
            1909,
            714,
            2082,
            752,
            2082,
            752,
            2082,
            752,
            2453,
            785,
            2453,
            785,
            2453,
            785,
            2510,
            826,
            2510,
            826,
            2510,
            826,
            2310,
            890,
            2310,
            890,
            2310,
            890,
            2151,
            871,
            2151,
            871,
            2151,
            871,
            1948,
            920,
            1948,
            920,
            1948,
            920,
            1625,
            874,
            1625,
            874,
            1625,
            874,
            1219,
            798,
            1219,
            798,
            1219,
            798,
            1099,
            755,
            1099,
            755,
            1099,
            755,
            1075,
            686,
            1075,
            686,
            1075,
            686,
            970,
            557,
            970,
            557,
            970,
            557,
            760,
            479,
            760,
            479,
            760,
            479,
            592,
            542,
            592,
            542,
            592,
            542,
            460,
            689,
            460,
            689,
            460,
            689,
            133,
            767,
            133,
            767,
            133,
            767,
            -56,
            923,
            -56,
            923,
            -56,
            923,
            -359,
            920,
            -359,
            920,
            -359,
            920,
            -776,
            1010,
            -776,
            1010,
            -776,
            1010,
            -1376,
            974,
            -1376,
            974,
            -1376,
            974,
            -1580,
            839,
            -1580,
            839,
            -1580,
            839,
            -1373,
            707,
            -1373,
            707,
            -1373,
            707,
            -1091,
            608,
            -1091,
            608,
            -1091,
            608,
            -824,
            578,
            -824,
            578,
            -824,
            578,
            -461,
            593,
            -461,
            593,
            -461,
            593,
            -371,
            470,
            -371,
            470,
            -371,
            470,
            -575,
            491,
            -575,
            491,
            -575,
            491,
            -1064,
            368,
            -1064,
            368,
            -1064,
            368,
            -1223,
            293,
            -1223,
            293,
            -1223,
            293,
            -1277,
            389,
            -1277,
            389,
            -1277,
            389,
            -1397,
            386,
            -1397,
            386,
            -1397,
            386,
            -1451,
            290,
            -1451,
            290,
            -1451,
            290,
            -1556,
            311,
            -1556,
            311,
            -1556,
            311,
            -1631,
            380,
            -1631,
            380,
            -1631,
            380,
            -1874,
            560,
            -1874,
            560,
            -1874,
            560,
            -2183,
            608,
            -2183,
            608,
            -2183,
            608,
            -2420,
            458,
            -2420,
            458,
            -2420,
            458,
            -2387,
            314,
            -2387,
            314,
            -2387,
            314,
            -2144,
            317,
            -2144,
            317,
            -2144,
            317,
            -2144,
            209,
            -2144,
            209,
            -2144,
            209,
            -2210,
            185,
            -2210,
            185,
            -2210,
            185,
            -2573,
            197,
            -2573,
            197,
            -2573,
            197,
            -3032,
            173,
            -3032,
            173,
            -3032,
            173,
            -3014,
            116,
            -3014,
            116,
            -3014,
            116,
            -3062,
            89,
            -3062,
            89,
            -3062,
            89,
            -3554,
            59,
            -3554,
            59,
            -3554,
            59,
            -3473,
            -34,
            -3473,
            -34,
            -3473,
            -34,
            -2990,
            2,
            -2990,
            2,
            -2990,
            2,
            -2978,
            47,
            -2978,
            47,
            -2978,
            47,
            -2876,
            104,
            -2876,
            104,
            -2876,
            104,
            -2792,
            47,
            -2792,
            47,
            -2792,
            47,
            -2225,
            2,
            -2225,
            2,
            -2225,
            2,
            -1805,
            113,
            -1805,
            113,
            -1805,
            113,
            -1664,
            242,
            -1664,
            242,
            -1664,
            242,
            -1556,
            215,
            -1556,
            215,
            -1556,
            215,
            -1361,
            197,
            -1361,
            197,
            -1361,
            197,
            -875,
            176,
            -875,
            176,
            -875,
            176,
            -617,
            176,
            -617,
            176,
            -617,
            176,
            -524,
            104,
            -524,
            104,
            -524,
            104,
            -425,
            59,
            -425,
            59,
            -425,
            59,
            -356,
            -130,
            -356,
            -130,
            -356,
            -130,
            -509,
            -259,
            -509,
            -259,
            -509,
            -259,
            -704,
            -490,
            -704,
            -490,
            -704,
            -490,
            -1019,
            -466,
            -1019,
            -466,
            -1019,
            -466,
            -1421,
            -418,
            -1421,
            -418,
            -1421,
            -418,
            -1607,
            -412,
            -1607,
            -412,
            -1607,
            -412,
            -1691,
            -523,
            -1691,
            -523,
            -1691,
            -523,
            -1820,
            -415,
            -1820,
            -415,
            -1820,
            -415,
            -2216,
            -331,
            -2216,
            -331,
            -2216,
            -331,
            -2384,
            -268,
            -2384,
            -268,
            -2384,
            -268,
            -2588,
            -193,
            -2588,
            -193,
            -2588,
            -193,
            -2864,
            -139,
            -2864,
            -139,
            -2864,
            -139,
            -3272,
            -223,
            -3272,
            -223,
            -3272,
            -223,
            -3377,
            -256,
            -3377,
            -256,
            -3377,
            -256,
            -3128,
            -337,
            -3128,
            -337,
            -3128,
            -337,
            -2813,
            -388,
            -2813,
            -388,
            -2813,
            -388,
            -2792,
            -444,
            -2792,
            -444,
            -2792,
            -444,
            -2876,
            -396,
            -2876,
            -396,
            -2876,
            -396,
            -2968,
            -371,
            -2968,
            -371,
            -2968,
            -371,
            -3058,
            -361,
            -3058,
            -361,
            -3058,
            -361,
            -3171,
            -347,
            -3171,
            -347,
            -3171,
            -347,
            -3247,
            -333,
            -3247,
            -333,
            -3247,
            -333,
            -3384,
            -294,
            -3384,
            -294,
            -3384,
            -294,
            -3446,
            -334,
            -3446,
            -334,
            -3446,
            -334,
            -3406,
            -354,
            -3406,
            -354,
            -3406,
            -354,
            -3412,
            -416,
            -3412,
            -416,
            -3412,
            -416,
            -3424,
            -453,
            -3424,
            -453,
            -3424,
            -453,
            -3470,
            -478,
            -3470,
            -478,
            -3470,
            -478,
            -3499,
            -481,
            -3499,
            -481,
            -3499,
            -481,
            -3580,
            -425,
            -3580,
            -425,
            -3580,
            -425,
            -3575,
            -495,
            -3575,
            -495,
            -3575,
            -495,
            -3561,
            -525,
            -3561,
            -525,
            -3561,
            -525,
            -3570,
            -584,
            -3570,
            -584,
            -3570,
            -584,
            -3580,
            -614,
            -3580,
            -614,
            -3580,
            -614,
            -3542,
            -665,
            -3542,
            -665,
            -3542,
            -665,
            -3533,
            -633,
            -3533,
            -633,
            -3533,
            -633,
            -3496,
            -637,
            -3496,
            -637,
            -3496,
            -637,
            -3467,
            -585,
            -3467,
            -585,
            -3467,
            -585,
            -3484,
            -529,
            -3484,
            -529,
            -3484,
            -529,
            -3381,
            -526,
            -3381,
            -526,
            -3381,
            -526,
            -3313,
            -472,
            -3313,
            -472,
            -3313,
            -472,
            -3295,
            -393,
            -3295,
            -393,
            -3295,
            -393,
            -3262,
            -388,
            -3262,
            -388,
            -3262,
            -388,
            -2937,
            -433,
            -2937,
            -433,
            -2937,
            -433,
            -2845,
            -486,
            -2845,
            -486,
            -2845,
            -486
        ]
        const triangleVerticesIndexs = earcut(polygonVerticesFlat)

        this.astarGraph = new AStarGraph(flatVertexs2Vec2(polygonVerticesFlat), triangleVerticesIndexs)
        // for (const triangle of this.astarGraph.trianglesMesh) {
        //     this.drawTriangle(this.graphicsContainer.getChildByName("mesh_graphics").getComponent(cc.Graphics), triangle)
        // }

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

