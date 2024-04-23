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

    private isTouching: boolean = false
    private mapQuadTree: QuadTree<tileMapData> = null
    private mapQuadSize: number = 16

    private mapOriSize: { width: number, height: number } = { width: 1024 * 7, height: 1024 * 4 }
    private mapTileSize: { width: number, height: number } = { width: 1024 * 7 / 16, height: 1024 * 4 / 16 }

    private trianglesGraph: GraphMatrix = null
    private navMeshTriangles: Array<Triangle> = []

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

            if (changePosX <= -this.viewPort.width / 2 && changePosX >= -this.mapOriSize.width + this.viewPort.width / 2) {
                this.mapContainer.x = changePosX
                this.rolesContainer.x = changePosX
            }

            if (changePosY <= -this.viewPort.height / 2 && changePosY >= -this.mapOriSize.height + this.viewPort.height / 2) {
                this.mapContainer.y = changePosY
                this.rolesContainer.y = changePosY
            }

            this.updateViewPortMapTileNodes()

        }, this)

        this.viewPort.on(cc.Node.EventType.TOUCH_START, (event: cc.Event.EventTouch) => {
            this.isTouching = true
        }, this)

        this.viewPort.on(cc.Node.EventType.TOUCH_END, (event: cc.Event.EventTouch) => {
            this.isTouching = false
        }, this)

        this.viewPort.on(cc.Node.EventType.TOUCH_CANCEL, (event: cc.Event.EventTouch) => {
            this.isTouching = false
        }, this)

    }

    private initTileMapQuadTree() {

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
    }

    private initTriangleNavMeshGraph() {

        this.trianglesGraph = new GraphMatrix()

        // 多边形顶点(扁平、二维)
        const polygonFlatVertices = [10, 0, 0, 50, 60, 60, 70, 10]
        const polygonVertices = []
        for (let i = 0; i < polygonFlatVertices.length; i += 2) {
            polygonVertices.push([polygonFlatVertices[i], polygonFlatVertices[i + 1]])
        }

        // 多边形切割为三角形(三个顶点索引)
        const triangleVerticesIndex = earcut(polygonFlatVertices)

        // 构建三角形网格无向图
        const vertexMap = new Map<string, number>()
        for (let i = 0; i < triangleVerticesIndex.length; i += 3) {

            // 构建三角形类
            const triangleVertices = triangleVerticesIndex.slice(i, i + 3)
            const vertice1 = polygonVertices[triangleVertices[0]]
            const vertice2 = polygonVertices[triangleVertices[1]]
            const vertice3 = polygonVertices[triangleVertices[2]]
            const triangle: Triangle = { id: Math.ceil(i / 3), vertices: [vertice1, vertice2, vertice3] }
            this.navMeshTriangles.push(triangle)
            this.trianglesGraph.addVertex(triangle.id)

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

        console.log(this.trianglesGraph.print())
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

type Triangle = {
    id: number
    vertices: [number, number, number]
}
