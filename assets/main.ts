/*
 * @Author: hyrm 
 * @Date: 2024-04-27 17:10:42 
 * @Last Modified by: hyrm
 * @Last Modified time: 2024-05-06 18:28:38
 */

const { ccclass, property } = cc._decorator
import { QuadTree, QuadTreeRect } from './script/dataStructure/QuadTree'
import EntityContainer from './script/components/EntityContainer'
import { AStarGridMesh, Block, BlockType } from "./script/algorithm/AStarGridMesh"
import GraphicsContainer, { GraphicsType } from './script/components/GraphicsContainer'
@ccclass
export default class Main extends cc.Component {

    @property(cc.Node)
    viewPort: cc.Node = null

    @property(cc.Node)
    map_container: cc.Node = null

    @property(cc.Node)
    fov_container: cc.Node = null

    @property(cc.Node)
    entity_container: cc.Node = null

    @property(cc.Node)
    graphics_container: cc.Node = null

    @property(cc.Node)
    entity_start: cc.Node = null

    @property(cc.Node)
    btn_edit: cc.Node = null

    @property(cc.Node)
    lbl_pos: cc.Node = null

    @property(cc.Node)
    lbl_mode: cc.Node = null

    private entityContainerCom: EntityContainer
    private graphicsContainerCom: GraphicsContainer

    private isEditing: boolean = false
    private editingBlock: BlockType = BlockType.BLOCK
    private isTouchMoving: boolean = false

    private mapOriSize: { width: number, height: number } = { width: 1024 * 7, height: 1024 * 4 }
    private mapTileSize: { width: number, height: number } = { width: 1024 * 7 / 16, height: 1024 * 4 / 16 }
    private mapQuadTree: QuadTree<tileMapData> = null
    private mapQuadSize: number = 16

    private fovTileSize: { width: number, height: number } = { width: 128, height: 128 }
    private fovQuadTree: QuadTree<fovTileData> = null
    private fovQuadSize: number = 56

    private mapData: MapData = null
    private astarGridhMesh: AStarGridMesh = null

    protected start() {
        this.entityContainerCom = this.entity_container.getComponent(EntityContainer)
        this.graphicsContainerCom = this.graphics_container.getComponent(GraphicsContainer)

        // 地图四叉树初始化(用于动态加载可视区域显示地图)
        console.time("MapQuadTree")
        this.initMapQuadTree()
        console.timeEnd("MapQuadTree")

        // 迷雾四叉树初始化(用于动态加载显示战争迷雾)
        console.time("FovQuadTree")
        this.initFovQuadTree()
        console.timeEnd("FovQuadTree")

        // 寻路网格初始化(用于寻路算法)
        console.time("astarGridMesh")
        this.initAStarGridMesh()
        console.timeEnd("astarGridMesh")

        // 地图触摸相关事件监听
        this.initEventListener()

        // 首次地图可视范围更新
        this.updateViewPortMapTileNodes()

    }



    private initMapQuadTree() {

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
            this.map_container.addChild(tileNode)

            // 建立基于世界坐标碰撞矩形
            const tileBoundsX = this.mapQuadTree.bounds.x + (cols - 1) * this.mapTileSize.width
            const tileBoundsY = this.mapQuadTree.bounds.y + (this.mapQuadSize - 1 - (rows - 1)) * this.mapTileSize.height
            const tileRect: QuadTreeRect = { x: tileBoundsX, y: tileBoundsY, width: this.mapTileSize.width, height: this.mapTileSize.height }
            const quadTreeObject: tileMapData = { owningRect: tileRect, node: tileNode }

            // 绑定碰撞矩形和地图块节点插入四叉树中
            this.mapQuadTree.insert(tileRect, quadTreeObject)
        }
    }

    private initFovQuadTree() {
        const boundsPosX = -this.mapOriSize.width / 2
        const boundsPosY = -this.mapOriSize.height / 2
        const boundsWidth = this.mapOriSize.width
        const boundsHeight = this.mapOriSize.height

        const rootBounds: QuadTreeRect = { x: boundsPosX, y: boundsPosY, width: boundsWidth, height: boundsHeight }
        this.fovQuadTree = new QuadTree<tileMapData>(rootBounds, 4)


        for (let i = 0; i < Math.pow(this.fovQuadSize, 2); i++) {

            const rows = Math.floor(i / this.fovQuadSize) + 1
            const cols = i % this.fovQuadSize + 1

            // 建立基于地图节点相对地图块坐标
            const tileNode = new cc.Node(`tile_${i}`)
            const halfTileWidth = this.fovTileSize.width / 2
            const halfTileHeight = this.fovTileSize.height / 2
            const tilePosX = cols <= this.fovQuadSize / 2 ? -((this.fovQuadSize / 2 - cols) * this.fovTileSize.width + halfTileWidth) : (cols - (this.fovQuadSize / 2 + 1)) * this.fovTileSize.width + halfTileWidth
            const tilePosY = rows <= this.fovQuadSize / 2 ? (this.fovQuadSize / 2 - rows) * this.fovTileSize.height + halfTileHeight : -((rows - (this.fovQuadSize / 2 + 1)) * this.fovTileSize.height + halfTileHeight)
            tileNode.setPosition(tilePosX, tilePosY)
            tileNode.setAnchorPoint(0.5, 0.5)
            this.fov_container.addChild(tileNode)

            // 建立基于世界坐标碰撞矩形
            const tileBoundsX = this.fovQuadTree.bounds.x + (cols - 1) * this.fovTileSize.width
            const tileBoundsY = this.fovQuadTree.bounds.y + (this.fovQuadSize - 1 - (rows - 1)) * this.fovTileSize.height
            const tileRect: QuadTreeRect = { x: tileBoundsX, y: tileBoundsY, width: this.fovTileSize.width, height: this.fovTileSize.height }
            const quadTreeObject: tileMapData = { owningRect: tileRect, node: tileNode }

            // 绑定碰撞矩形和地图块节点插入四叉树中
            this.fovQuadTree.insert(tileRect, quadTreeObject)
        }
    }

    private initAStarGridMesh() {
        cc.resources.load("mapData", cc.JsonAsset, (err, data) => {

            this.mapData = data.json as MapData
            this.astarGridhMesh = new AStarGridMesh(data.json as MapData)
            this.drawMapMesh()
        })
    }

    private initEventListener() {

        this.viewPort.on(cc.Node.EventType.TOUCH_MOVE, (event: cc.Event.EventTouch) => {
            this.isTouchMoving = true

            const delta = event.touch.getDelta()

            // 边界判断,因项目适配宽度,不同设备高度不同,这里取屏幕高度做判断
            const changePosY = this.map_container.y + delta.y
            const changePosX = this.map_container.x + delta.x

            if (Math.abs(changePosX) <= this.mapOriSize.width / 2 - this.viewPort.width / 2) {
                this.map_container.x = changePosX
                this.entity_container.x = changePosX
                this.graphics_container.x = changePosX
            }

            if (Math.abs(changePosY) <= this.mapOriSize.height / 2 - this.viewPort.height / 2) {
                this.map_container.y = changePosY
                this.entity_container.y = changePosY
                this.graphics_container.y = changePosY
            }

            this.updateViewPortMapTileNodes()

        }, this)

        this.viewPort.on(cc.Node.EventType.TOUCH_START, (event: cc.Event.EventTouch) => {
            this.isTouchMoving = false
        }, this)

        this.viewPort.on(cc.Node.EventType.TOUCH_END, (event: cc.Event.EventTouch) => {

            // 寻路绘制
            if (!this.isTouchMoving && !this.isEditing) {

                const mapPos = this.map_container.convertToNodeSpaceAR(event.getLocation())
                const entityPos = this.entity_start.getPosition()

                this.graphicsContainerCom.clear(GraphicsType.PATH)

                const result = this.astarGridhMesh.findPath(entityPos, cc.v2(Math.ceil(mapPos.x), Math.ceil(mapPos.y)), (block) => {
                    const blockPos = this.astarGridhMesh.getPosByBlock(block)
                    this.graphicsContainerCom.drawRect(GraphicsType.PATH, cc.rect(blockPos.x, blockPos.y, 32, 32), cc.Color.GRAY)
                })

                // 一般寻路路径
                for (const block of result.path) {
                    const blockPos = this.astarGridhMesh.getPosByBlock(block)
                    this.graphicsContainerCom.drawRect(GraphicsType.PATH, cc.rect(blockPos.x, blockPos.y, 32, 32), cc.color(0, 0, 255, 255))
                }

                // 合并共线路径
                for (const block of result.collinearPath) {
                    const blockPos = this.astarGridhMesh.getPosByBlock(block)
                    this.graphicsContainerCom.drawRect(GraphicsType.PATH, cc.rect(blockPos.x, blockPos.y, 32, 32), cc.color(255, 255, 255, 255))
                }

                const vec2Path: Array<cc.Vec2> = []
                // 去除拐点路径
                for (const [index, block] of result.smoothPath.entries()) {
                    const blockPos = this.astarGridhMesh.getPosByBlock(block)
                    this.graphicsContainerCom.drawRect(GraphicsType.PATH, cc.rect(blockPos.x + 8, blockPos.y + 8, 16, 16), cc.color(0, 0, 0, 255), true)

                    if (index < result.smoothPath.length - 1) {
                        const startPos = this.astarGridhMesh.getPosByBlock(result.smoothPath[index])
                        const endPos = this.astarGridhMesh.getPosByBlock(result.smoothPath[index + 1])
                        this.graphicsContainerCom.drawLine(GraphicsType.PATH, [cc.v2(startPos.x + 16, startPos.y + 16), cc.v2(endPos.x + 16, endPos.y + 16)], cc.Color.ORANGE)
                    }
                    vec2Path.push(cc.v2(blockPos.x + 16, blockPos.y + 16))
                }

                // 实体移动
                this.entityContainerCom.addShadowPos(this.entity_start.name, vec2Path.reverse())
            }

            // 编辑地图
            if (this.isEditing && !this.isTouchMoving) {
                const mapPos = this.map_container.convertToNodeSpaceAR(event.getLocation())
                const block = this.astarGridhMesh.getBlockByPos(mapPos)
                const blockPos = this.astarGridhMesh.getPosByBlock(block)
                this.lbl_pos.getComponent(cc.Label).string = `(${Math.ceil(mapPos.x)},${Math.ceil(mapPos.y)})\n(${blockPos.x},${blockPos.y})`
                block.type = this.editingBlock
                this.mapData.roadDataArr[block.y][block.x] = block.type
                this.drawMapMesh()
            }

            // 坐标显示
            if (!this.isTouchMoving) {
                const mapPos = this.map_container.convertToNodeSpaceAR(event.getLocation())
                const block = this.astarGridhMesh.getBlockByPos(mapPos)
                this.lbl_pos.getComponent(cc.Label).string = `(${Math.ceil(mapPos.x)},${Math.ceil(mapPos.y)})\n(${block.x},${block.y})`
            }

            // const mapPos = this.mapContainer.convertToNodeSpaceAR(event.getLocation())
            // const block = this.astarGridhMesh.getBlockByPos(mapPos)
            // const blockPos = this.astarGridhMesh.getPosByBlock(block)
            // this.graphicsContainerCom.drawFov(GraphicsType.WARFOV, cc.rect(blockPos.x, blockPos.y, 32, 32))

            this.isTouchMoving = false
        }, this)

        this.viewPort.on(cc.Node.EventType.TOUCH_CANCEL, (event: cc.Event.EventTouch) => {
            this.isTouchMoving = false
        }, this)

        this.btn_edit.on(cc.Node.EventType.TOUCH_END, (event: cc.Event.EventTouch) => {
            if (this.isEditing) {
                this.drawMapMesh()
                this.outPutMapData()
            }

            this.isEditing = !this.isEditing
            this.btn_edit.getChildByName("lbl").getComponent(cc.Label).string = this.isEditing ? "保存" : "编辑"
            this.lbl_mode.color = this.editingBlock === BlockType.BLOCK ? cc.Color.GREEN : cc.Color.RED
            this.lbl_mode.active = this.isEditing
        })

        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, (event: cc.Event.EventKeyboard) => {
            switch (event.keyCode) {
                case cc.macro.KEY.w:
                    this.editingBlock = BlockType.BLOCK
                    break
                case cc.macro.KEY.e:
                    this.editingBlock = BlockType.WALL
                    break
            }
            this.lbl_mode.color = this.editingBlock == BlockType.BLOCK ? cc.Color.GREEN : cc.Color.RED
        })

    }

    private updateViewPortMapTileNodes() {

        // 计算视口矩形
        const viewportBoundX = (0 - this.viewPort.width / 2) - this.map_container.x
        const viewportBoundY = (0 - this.viewPort.height / 2) - this.map_container.y
        const viewportRect: QuadTreeRect = { x: viewportBoundX, y: viewportBoundY, width: this.viewPort.width, height: this.viewPort.height }

        // 判断视口与地图四叉树碰撞
        const visiableTileObjects: tileMapData[] = this.mapQuadTree.retrieve(viewportRect)

        // 动态显示可视区域地图块节点
        this.map_container.children.forEach((node: cc.Node) => node.active = false)

        for (const tileObject of visiableTileObjects) {
            tileObject.node.active = true
            if (tileObject.node.getComponent(cc.Sprite)) continue

            cc.resources.load(tileObject.node.name, cc.SpriteFrame, (err, spriteFrame) => {
                tileObject.node.addComponent(cc.Sprite).spriteFrame = spriteFrame
            })
        }
    }

    private drawMapMesh() {
        this.graphicsContainerCom.clear(GraphicsType.MESH)

        for (const block of this.astarGridhMesh.allBlocks) {
            const pos = this.astarGridhMesh.getPosByBlock(block)

            switch (block.type) {

                case BlockType.BLOCK:
                    this.graphicsContainerCom.drawRect(GraphicsType.MESH, cc.rect(pos.x, pos.y, 32, 32), cc.color(0, 255, 0, 80))
                    break
                case BlockType.WALL:
                    this.graphicsContainerCom.drawRect(GraphicsType.MESH, cc.rect(pos.x, pos.y, 32, 32), cc.color(255, 0, 0, 80), true)
                    break
            }
        }

        // 战争迷雾地图块
        for (let i = 1; i < this.mapOriSize.width / 128; i++) {
            const startX = i * 128 - this.mapOriSize.width / 2
            const startY = this.mapOriSize.height / 2

            const endX = i * 128 - this.mapOriSize.width / 2
            const endY = -this.mapOriSize.height / 2

            this.graphicsContainerCom.drawLine(GraphicsType.MESH, [cc.v2(startX, startY), cc.v2(endX, endY)], cc.Color.GRAY)

        }

        for (let i = 1; i < this.mapOriSize.height / 128; i++) {
            const startX = -this.mapOriSize.width / 2
            const startY = i * 128 - this.mapOriSize.height / 2
            const endX = this.mapOriSize.width / 2
            const endY = i * 128 - this.mapOriSize.height / 2

            this.graphicsContainerCom.drawLine(GraphicsType.MESH, [cc.v2(startX, startY), cc.v2(endX, endY)], cc.Color.GRAY)
        }

        // this.graphicsContainerCom.drawRect(GraphicsType.WARFOV, cc.rect(-this.mapOriSize.width / 2, -this.mapOriSize.height / 2, this.mapOriSize.width, this.mapOriSize.height), cc.color(0, 0, 0, 150), true)
    }

    private outPutMapData() {
        const content = JSON.stringify(this.mapData, null, "")
        const fileName = 'mapData.json'

        const blob = new Blob([content], { type: 'text/json' })
        const url = URL.createObjectURL(blob)

        const link = document.createElement('a')
        link.href = url
        link.download = fileName

        document.body.appendChild(link)

        link.click()

        URL.revokeObjectURL(url)
        document.body.removeChild(link)
    }
}



type tileMapData = {
    owningRect: QuadTreeRect,
    node: cc.Node
}

type fovTileData = {
    owningRect: QuadTreeRect,
    node: cc.Node,
}

