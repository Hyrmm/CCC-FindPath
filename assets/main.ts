/*
 * @Author: hyrm 
 * @Date: 2024-04-27 17:10:42 
 * @Last Modified by: hyrm
 * @Last Modified time: 2024-05-07 18:01:29
 */

const { ccclass, property } = cc._decorator
import { QuadTree, QuadTreeRect } from './script/dataStructure/QuadTree'
import EntityContainer, { EntityState } from './script/components/EntityContainer'
import { AStarGridMesh, Block, BlockType } from "./script/algorithm/AStarGridMesh"
import GraphicsContainer, { GraphicsType } from './script/components/GraphicsContainer'
import FovContainer from './script/components/FovContainer'
import MapContainer from './script/components/MapContainer'
@ccclass
export default class Main extends cc.Component {

    @property(cc.Node)
    viewPort: cc.Node = null

    @property(cc.Node)
    bounding_box: cc.Node = null

    @property(cc.Node)
    map_container: cc.Node = null

    @property(cc.Node)
    fov_container: cc.Node = null

    @property(cc.Node)
    entity_container: cc.Node = null

    @property(cc.Node)
    graphics_container: cc.Node = null

    @property(cc.Node)
    btn_edit: cc.Node = null

    @property(cc.Node)
    lbl_pos: cc.Node = null

    @property(cc.Node)
    lbl_mode: cc.Node = null

    // 子节点组件
    private entityContainerCom: EntityContainer
    private graphicsContainerCom: GraphicsContainer
    private fovContainerCom: FovContainer
    private mapContainerCom: MapContainer

    // 地图编辑相关属性
    private isEditing: boolean = false
    private editingBlock: BlockType = BlockType.BLOCK
    private isTouchMoving: boolean = false

    // 寻路地图相关数据
    private mapData: MapData = null
    private astarGridhMesh: AStarGridMesh = null
    private mapOriSize: { width: number, height: number } = { width: 1024 * 7, height: 1024 * 4 }

    // 视角跟随拖动相数据
    private cameraTargetPos: cc.Vec2 | null = null
    private cameraFollowBounds: cc.Rect | null = null

    protected start() {

        this.mapContainerCom = this.map_container.getComponent(MapContainer)
        this.fovContainerCom = this.fov_container.getComponent(FovContainer)
        this.entityContainerCom = this.entity_container.getComponent(EntityContainer)
        this.graphicsContainerCom = this.graphics_container.getComponent(GraphicsContainer)

        const viewportCenterPos = this.viewPort.convertToWorldSpaceAR(cc.v2(0, 0))
        this.cameraFollowBounds = cc.rect(viewportCenterPos.x - 50, viewportCenterPos.y - 300, 100, 600)


        // 地图四叉树
        console.time("MapQuadTree")
        this.mapContainerCom.initMapQuadTree(this.mapOriSize)
        console.timeEnd("MapQuadTree")

        // 迷雾四叉树
        console.time("FovQuadTree")
        this.fovContainerCom.initFovQuadTree(this.mapOriSize)
        console.timeEnd("FovQuadTree")

        // AStar寻路网格
        console.time("astarGridMesh")
        this.initAStarGridMesh()
        console.timeEnd("astarGridMesh")

        // 地图触摸相关事件监听
        this.initEventListener()

        // 首次地图可视范围更新
        this.scheduleOnce(this.updateVisibleTiles.bind(this), 0.1)
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

            const delta = event.touch.getDelta()
            if (delta.x == 0 && delta.y == 0) return

            this.isTouchMoving = true

            // 边界判断,因项目适配宽度,不同设备高度不同,这里取屏幕高度做判断
            let deltaX, deltaY
            const changePosY = this.map_container.y + delta.y * 40
            const changePosX = this.map_container.x + delta.x * 40

            console.log(delta.x, delta.y)

            if (Math.abs(changePosX) <= this.mapOriSize.width / 2 - this.viewPort.width / 2) {
                // this.map_container.x = changePosX
                // this.entity_container.x = changePosX
                // this.graphics_container.x = changePosX
                // this.fov_container.x = changePosX
                deltaX = changePosX
            }

            if (Math.abs(changePosY) <= this.mapOriSize.height / 2 - this.viewPort.height / 2) {
                // this.map_container.y = changePosY
                // this.entity_container.y = changePosY
                // this.graphics_container.y = changePosY
                // this.fov_container.y = changePosY
                deltaY = changePosY
            }

            this.cameraTargetPos = cc.v2(deltaX ? deltaX : this.map_container.x, deltaY ? deltaY : this.map_container.y)

        }, this)

        this.viewPort.on(cc.Node.EventType.TOUCH_START, (event: cc.Event.EventTouch) => {
            this.isTouchMoving = false
        }, this)

        this.viewPort.on(cc.Node.EventType.TOUCH_END, (event: cc.Event.EventTouch) => {

            // 寻路绘制
            if (!this.isTouchMoving && !this.isEditing) {

                const mapPos = this.map_container.convertToNodeSpaceAR(event.getLocation())
                const entityPos = this.entityContainerCom.getEntity("entity_start").getPosition()

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
                this.entityContainerCom.addCommonPos("entity_start", vec2Path.reverse())
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
                const blockPos = this.astarGridhMesh.getPosByBlock(block)
                this.lbl_pos.getComponent(cc.Label).string = `(${Math.ceil(mapPos.x)},${Math.ceil(mapPos.y)})\n(${block.x},${block.y})\n(${blockPos.x},${blockPos.y})`
            }

            // 视野范围
            // if (!this.isEditing && !this.isTouchMoving) {
            //     const mapPos = this.map_container.convertToNodeSpaceAR(event.getLocation())
            //     const block = this.astarGridhMesh.getBlockByPos(mapPos)
            //     const blockPos = this.astarGridhMesh.getPosByBlock(block)

            //     for (const eyeBlock of this.astarGridhMesh.getNeighbors(block)) {
            //         const eyeBlockPos = this.astarGridhMesh.getPosByBlock(eyeBlock)
            //         this.graphicsContainerCom.drawRect(GraphicsType.PATH, cc.rect(eyeBlockPos.x, eyeBlockPos.y, 32, 32), cc.color(0, 255, 0, 150), true)
            //     }

            //     const rect: QuadTreeRect = { x: Math.ceil(blockPos.x - 32), y: Math.ceil(blockPos.y - 32), width: 96, height: 96 }
            //     const result = this.fovContainerCom.retrieve(rect)
            //     for (const tile of result) {
            //         if (tile.unlock) continue
            //         tile.unlock = true
            //     }
            // }

            this.updateVisibleTiles()
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

    private updateCameraTouch(dt: number) {

        if (!this.cameraTargetPos) return


        const delta = Math.min((dt * 1000) / 100, 1)
        const distanceVec = this.cameraTargetPos.sub(cc.v2(this.map_container.x, this.map_container.y))
        const distance = distanceVec.mag()

        if (distance < 1) {
            this.map_container.setPosition(this.cameraTargetPos)
            this.graphics_container.setPosition(this.cameraTargetPos)
            this.entity_container.setPosition(this.cameraTargetPos)
            this.cameraTargetPos = null
            this.updateVisibleTiles()
        } else {
            const offsetPos = new cc.Vec2(this.cameraTargetPos.x - this.map_container.x, this.cameraTargetPos.y - this.map_container.y)
            const interpolationX = Math.abs(offsetPos.x) <= 5 ? offsetPos.x : delta * offsetPos.x
            const interpolationY = Math.abs(offsetPos.y) <= 5 ? offsetPos.y : delta * offsetPos.y
            const targetPos = this.map_container.position.add(new cc.Vec3(interpolationX, interpolationY, 0))
            this.map_container.setPosition(targetPos)
            this.graphics_container.setPosition(targetPos)
            this.entity_container.setPosition(targetPos)
        }



    }

    private updateVisibleTiles() {

        // 计算视口矩形
        const viewportBoundX = (0 - this.viewPort.width / 2) - this.map_container.x
        const viewportBoundY = (0 - this.viewPort.height / 2) - this.map_container.y
        const viewportRect: QuadTreeRect = { x: viewportBoundX, y: viewportBoundY, width: this.viewPort.width, height: this.viewPort.height }

        console.time("update:mapTile")
        this.mapContainerCom.updateVisableTiles(viewportRect)
        console.timeEnd("update:mapTile")

        console.time("update:fovTile")
        this.fovContainerCom.updateVisableTiles(viewportRect)
        console.timeEnd("update:fovTile")


    }

    private updateCameraFollow(dt: number) {

        if (this.entityContainerCom.getEntity("entity_start").state != EntityState.MOVING) return
        if (this.cameraTargetPos) this.cameraTargetPos = null

        const entityPos = this.entityContainerCom.getEntity("entity_start").getPosition()

        const entityWorldPos = this.map_container.convertToWorldSpaceAR(entityPos)
        const viewportCentPos = this.viewPort.convertToWorldSpaceAR(cc.v2(0, 0))

        if (!this.cameraFollowBounds.contains(entityWorldPos)) {
            const delta = Math.min((dt * 1000) / 1000, 1)
            const offsetPos = cc.v2(viewportCentPos.x - entityWorldPos.x, viewportCentPos.y - entityWorldPos.y)

            if (!offsetPos.equals(cc.Vec2.ZERO)) {
                // 极限情况，真实位置永远趋近于目标影子位置，当相离位置小于0.1像素时直接修正到目标影子位置
                const interpolationX = Math.abs(offsetPos.x) <= 0.5 ? offsetPos.x : delta * offsetPos.x
                const interpolationY = Math.abs(offsetPos.y) <= 0.5 ? offsetPos.y : delta * offsetPos.y
                this.map_container.position = this.map_container.position.add(cc.v3(interpolationX, interpolationY, 0))
                this.graphics_container.position = this.graphics_container.position.add(cc.v3(interpolationX, interpolationY, 0))
                this.entity_container.position = this.entity_container.position.add(cc.v3(interpolationX, interpolationY, 0))
            }
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

        // // 战争迷雾地图块
        // for (let i = 1; i < this.mapOriSize.width / 224; i++) {
        //     const startX = i * 224 - this.mapOriSize.width / 2
        //     const startY = this.mapOriSize.height / 2

        //     const endX = i * 224 - this.mapOriSize.width / 2
        //     const endY = -this.mapOriSize.height / 2

        //     this.graphicsContainerCom.drawLine(GraphicsType.MESH, [cc.v2(startX, startY), cc.v2(endX, endY)], cc.Color.ORANGE)

        // }

        // for (let i = 1; i < this.mapOriSize.height / 128; i++) {
        //     const startX = -this.mapOriSize.width / 2
        //     const startY = i * 128 - this.mapOriSize.height / 2
        //     const endX = this.mapOriSize.width / 2
        //     const endY = i * 128 - this.mapOriSize.height / 2

        //     this.graphicsContainerCom.drawLine(GraphicsType.MESH, [cc.v2(startX, startY), cc.v2(endX, endY)], cc.Color.ORANGE)
        // }

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

    protected update(dt: number): void {

        // 视角拖动
        this.updateCameraTouch(dt)

        // 视角跟随
        this.updateCameraFollow(dt)



    }
}
