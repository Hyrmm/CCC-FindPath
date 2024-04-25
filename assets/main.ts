const { ccclass, property } = cc._decorator
import { QuadTree, QuadTreeObject, QuadTreeRect } from './script/dataStructure/QuadTree'
import { GraphMatrix } from './script/dataStructure/Graph'
import { AStarGraph, Triangle } from './script/algorithm/AStarGraph'
import earcut from "earcut"

@ccclass
export default class Main extends cc.Component {

    @property(cc.Node)
    viewPort: cc.Node = null

    @property(cc.Node)
    mapContainer: cc.Node = null

    @property(cc.Node)
    rolesContainer: cc.Node = null

    @property(cc.Node)
    pathsContainer: cc.Node = null

    @property(cc.Node)
    entity_end: cc.Node = null

    @property(cc.Node)
    entity_role: cc.Node = null

    private isTouching: boolean = false
    private mapQuadTree: QuadTree<tileMapData> = null
    private mapQuadSize: number = 16

    private mapScale: number = 1
    private mapOriSize: { width: number, height: number } = { width: 1024 * 7, height: 1024 * 4 }
    private mapTileSize: { width: number, height: number } = { width: 1024 * 7 / 16, height: 1024 * 4 / 16 }


    private astarGraph: AStarGraph = null


    start() {

        // 地图触摸相关事件监听
        this.initTouchEventListener()

        // 四叉树初始化(用于动态加载可视区域显示地图)
        this.initTileMapQuadTree()

        // 寻路网格初始化(用于寻路算法)
        this.initTriangleNavMeshGraph()

        // 首次地图可视范围更新
        this.updateViewPortMapTileNodes()

    }



    private initTouchEventListener() {
        const tempV = []

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
                this.rolesContainer.x = changePosX
            }

            if (Math.abs(changePosY) <= this.mapOriSize.height / 2 - this.viewPort.height / 2) {
                this.mapContainer.y = changePosY
                this.rolesContainer.y = changePosY
            }

            this.updateViewPortMapTileNodes()

        }, this)

        this.viewPort.on(cc.Node.EventType.TOUCH_START, (event: cc.Event.EventTouch) => {
            this.isTouching = true


            const mapPos = this.mapContainer.convertToNodeSpaceAR(event.getLocation())
            mapPos.x = Math.ceil(mapPos.x)
            mapPos.y = Math.ceil(mapPos.y)

            this.node.getChildByName("fixed").getChildByName("lbl_pos").getComponent(cc.Label).string = `(${mapPos.x.toFixed(2)}, ${mapPos.y.toFixed(2)})`

            tempV.push(mapPos.x, mapPos.y)

            if (isPlacingEnd) isPlacingEnd = false
            if (isPlacingRole) isPlacingRole = false

            console.log(this.astarGraph.getTriangleIdByPos(mapPos))


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
                this.entity_role.x = Math.ceil(mapPos.x)
                this.entity_role.y = Math.ceil(mapPos.y)
            }

        })

        this.entity_end.on(cc.Node.EventType.TOUCH_START, (event: cc.Event.EventTouch) => {
            if (isPlacingEnd) {
                const start = new cc.Vec2(this.entity_role.x, this.entity_role.y)
                const end = new cc.Vec2(this.entity_end.x, this.entity_end.y)
                this.pathsContainer.getComponent(cc.Graphics).clear()
                for (const triangle of this.astarGraph.findTrianglePath(start, end)) {
                    this.drawTriangle(this.pathsContainer.getComponent(cc.Graphics), triangle, cc.Color.GREEN)
                }
            }
            isPlacingEnd = !isPlacingEnd
        })

        this.entity_role.on(cc.Node.EventType.TOUCH_START, (event: cc.Event.EventTouch) => {
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
        // 多边形顶点(扁平、二维)
        const polygonVerticesFlat = [-94, 474, 218, 457, 239, 203, 76, 66, -87, 76, -193, -94, -283, 261, -209, 594]

        const polygonVertices = []
        for (let i = 0; i < polygonVerticesFlat.length; i += 2) {
            polygonVertices.push([polygonVerticesFlat[i], polygonVerticesFlat[i + 1]])
        }

        // 多边形切割为三角形(三个顶点索引)
        const triangleVerticesIndex = earcut(polygonVerticesFlat)

        // 构建三角形网格无向图
        const triangles: Triangle[] = []
        const trianglesGraph = new GraphMatrix()
        const vertexCache = new Map<string, Array<Triangle>>()
        for (let i = 0; i < triangleVerticesIndex.length; i += 3) {

            // 构建三角形类:给图中添加顶点
            const triangleVertices = triangleVerticesIndex.slice(i, i + 3)
            const vertice1 = polygonVertices[triangleVertices[0]]
            const vertice2 = polygonVertices[triangleVertices[1]]
            const vertice3 = polygonVertices[triangleVertices[2]]

            const triangle: Triangle = { id: Math.floor(i / 3), vertices: [new cc.Vec2(vertice1[0], vertice1[1]), new cc.Vec2(vertice2[0], vertice2[1]), new cc.Vec2(vertice3[0], vertice3[1])] }
            triangles.push(triangle)
            trianglesGraph.addVertex(triangle.id)

            // 构建三角形类:给图中添加顶点
            for (const vertice of triangle.vertices) {

                const key = `${vertice.x},${vertice.y}`

                if (!vertexCache.has(key)) {
                    vertexCache.set(key, [triangle])
                    continue
                }

                // 通过判断俩三角形是否存在邻接边,来构建图中邻接边
                const neighborTriangles = vertexCache.get(key)

                for (const neighborTriangle of neighborTriangles) {
                    const vertices1 = triangle.vertices.filter(v => v.x !== vertice.x || v.y !== vertice.y)
                    const vertices2 = neighborTriangle.vertices.filter(v => v.x !== vertice.x || v.y !== vertice.y)

                    for (const vertex of vertices1) {

                        if ((vertices2[0].x == vertex.x && vertices2[0].y == vertex.y) || (vertices2[1].x == vertex.x && vertices2[1].y == vertex.y)) {
                            trianglesGraph.addEdge(triangle.id, neighborTriangle.id)
                            break
                        }

                    }
                }

                vertexCache.get(key).push(triangle)


            }


        }
        this.astarGraph = new AStarGraph(trianglesGraph, triangles)

        for (const triangle of triangles) {
            this.drawTriangle(this.rolesContainer.getComponent(cc.Graphics), triangle)
        }
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

    private drawLine(start: cc.Vec2, end: cc.Vec2) {
        let ctx = this.rolesContainer.getComponent(cc.Graphics)
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(end.x, end.y)
        ctx.lineWidth = 5
        ctx.strokeColor = cc.Color.RED
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

