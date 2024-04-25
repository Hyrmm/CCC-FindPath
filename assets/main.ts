const { ccclass, property } = cc._decorator
import { QuadTree, QuadTreeObject, QuadTreeRect } from './script/dataStructure/QuadTree'
import { GraphMatrix } from './script/dataStructure/Graph'
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
    btn_edit: cc.Node = null

    @property(cc.Node)
    btn_place: cc.Node = null

    @property(cc.Node)
    entity_role: cc.Node = null

    private isTouching: boolean = false
    private mapQuadTree: QuadTree<tileMapData> = null
    private mapQuadSize: number = 16

    private mapScale: number = 1
    private mapOriSize: { width: number, height: number } = { width: 1024 * 7, height: 1024 * 4 }
    private mapTileSize: { width: number, height: number } = { width: 1024 * 7 / 16, height: 1024 * 4 / 16 }

    private trianglesGraph: GraphMatrix = null
    private navMeshTriangles: Array<Triangle> = []
    private polygonFlatVertices: Array<number> = []

    private isEditMode: boolean = false
    private isPlaceing: boolean = false

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

            // 编辑路径
            if (this.isEditMode) {
                if (this.polygonFlatVertices.length) {
                    const length = this.polygonFlatVertices.length
                    const startPos = new cc.Vec2(this.polygonFlatVertices[length - 2], this.polygonFlatVertices[length - 1])
                    const endPos = mapPos
                    this.drawLine(startPos, endPos)
                }
                this.polygonFlatVertices.push(mapPos.x, mapPos.y)
            }

            // 放置起点
            if (this.isPlaceing) {
                this.entity_role.x = mapPos.x
                this.entity_role.y = mapPos.y
                this.isPlaceing = false
                this.btn_place.active = true
                this.findTrianglePath(mapPos, mapPos)
            }

        }, this)

        this.viewPort.on(cc.Node.EventType.TOUCH_END, (event: cc.Event.EventTouch) => {
            this.isTouching = false
        }, this)

        this.viewPort.on(cc.Node.EventType.TOUCH_CANCEL, (event: cc.Event.EventTouch) => {
            this.isTouching = false
        }, this)

        this.btn_edit.on(cc.Node.EventType.TOUCH_START, (event: cc.Event.EventTouch) => {
            this.isEditMode = !this.isEditMode
            this.btn_edit.color = this.isEditMode ? cc.Color.GREEN : cc.Color.RED
            this.btn_edit.getChildByName("lbl").getComponent(cc.Label).string = this.isEditMode ? "edit-on" : "edit-off"
            if (!this.isEditMode) {
                this.rolesContainer.getComponent(cc.Graphics).clear()
                this.initTriangleNavMeshGraph()
            }
        }, this)

        this.btn_place.on(cc.Node.EventType.TOUCH_START, (event: cc.Event.EventTouch) => {
            this.isPlaceing = true
            this.btn_place.active = false
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

        this.trianglesGraph = new GraphMatrix()

        // 多边形顶点(扁平、二维)
        const polygonVertices = []
        for (let i = 0; i < this.polygonFlatVertices.length; i += 2) {
            polygonVertices.push([this.polygonFlatVertices[i], this.polygonFlatVertices[i + 1]])
        }

        // 多边形切割为三角形(三个顶点索引)
        const triangleVerticesIndex = earcut(this.polygonFlatVertices)

        // 构建三角形网格无向图
        const vertexMap = new Map<string, number>()
        for (let i = 0; i < triangleVerticesIndex.length; i += 3) {

            // 构建三角形类:给图中添加顶点
            const triangleVertices = triangleVerticesIndex.slice(i, i + 3)
            const vertice1 = polygonVertices[triangleVertices[0]]
            const vertice2 = polygonVertices[triangleVertices[1]]
            const vertice3 = polygonVertices[triangleVertices[2]]
            const triangle: Triangle = { id: Math.ceil(i / 3), vertices: [vertice1, vertice2, vertice3] }
            this.navMeshTriangles.push(triangle)
            this.trianglesGraph.addVertex(triangle.id)
            this.drawTriangle(triangle)

            // 构建三角形类:给图中添加顶点
            for (const vertice of triangle.vertices) {

                const key = `${vertice[0]},${vertice[1]}`

                if (!vertexMap.has(key)) {

                    vertexMap.set(key, triangle.id)

                } else {

                    // 通过判断俩三角形是否存在邻接边,来构建图中邻接边
                    const neighborTriangleId = vertexMap.get(key)
                    const neighborTriangle = this.navMeshTriangles[neighborTriangleId]
                    const vertices1 = triangle.vertices.filter(v => v[0] !== vertice[0] || v[1] !== vertice[1])
                    const vertices2 = neighborTriangle.vertices.filter(v => v[0] !== vertice[0] || v[1] !== vertice[1])

                    for (const vertex of vertices1) {
                        if ((vertices2[0][0] == vertex[0] && vertices2[0][1] == vertex[1]) || (vertices2[1][0] == vertex[0] && vertices2[1][1] == vertex[1])) {
                            this.trianglesGraph.addEdge(triangle.id, neighborTriangleId)
                            break
                        }
                    }
                }

            }
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

    private findTrianglePath(startPos: cc.Vec2, endPos: cc.Vec2) {
        let startTriangleId, endTriangleId
        for (const triangle of this.navMeshTriangles) {
            const a = new cc.Vec2(triangle.vertices[0][0], triangle.vertices[0][1])
            const b = new cc.Vec2(triangle.vertices[1][0], triangle.vertices[1][1])
            const c = new cc.Vec2(triangle.vertices[2][0], triangle.vertices[2][1])

            const AB_AP1 = b.sub(a).cross(startPos.sub(a))
            const BC_BP1 = c.sub(b).cross(startPos.sub(b))
            const CA_CP1 = a.sub(c).cross(startPos.sub(c))

            const AB_AP2 = b.sub(a).cross(endPos.sub(a))
            const BC_BP2 = c.sub(b).cross(endPos.sub(b))
            const CA_CP2 = a.sub(c).cross(endPos.sub(c))

            if (AB_AP1 > 0 && BC_BP1 > 0 && CA_CP1 > 0) {
                this.drawTriangle(triangle, cc.Color.GREEN)
                startTriangleId = triangle.id
            }

            if (AB_AP2 > 0 && BC_BP2 > 0 && CA_CP2 > 0) {
                endTriangleId = triangle.id
            }
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

    private drawTriangle(triangle: Triangle, color: cc.Color = cc.Color.RED) {
        let ctx = this.rolesContainer.getComponent(cc.Graphics)
        const vertice1 = triangle.vertices[0]
        const vertice2 = triangle.vertices[1]
        const vertice3 = triangle.vertices[2]
        ctx.moveTo(vertice1[0], vertice1[1])
        ctx.lineTo(vertice2[0], vertice2[1])
        ctx.lineTo(vertice3[0], vertice3[1])
        ctx.lineTo(vertice1[0], vertice1[1])
        ctx.lineWidth = 5
        ctx.strokeColor = color
        ctx.stroke()
    }
}

type tileMapData = {
    owningRect: QuadTreeRect,
    node: cc.Node
}

type Triangle = {
    id: number
    vertices: [[number, number], [number, number], [number, number]]
}
