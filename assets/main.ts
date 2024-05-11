/*
 * @Author: hyrm 
 * @Date: 2024-04-27 17:10:42 
 * @Last Modified by: hyrm
 * @Last Modified time: 2024-05-11 18:27:45
 */

const { ccclass, property } = cc._decorator
import { QuadTree, QuadTreeRect } from './script/dataStructure/QuadTree'
import EntityContainer, { EntityState } from './script/components/EntityContainer'
import { AStarGridMesh, Block, BlockType } from "./script/algorithm/AStarGridMesh"
import GraphicsContainer, { GraphicsType } from './script/components/GraphicsContainer'
import FovContainer from './script/components/FovContainer'
import MapContainer from './script/components/MapContainer'
import { outPutJsonFile, throttle } from './script/utils/Utils'
@ccclass
export default class Main extends cc.Component {

    @property(cc.Node)
    viewPort: cc.Node = null

    // 地图瓦片容器
    @property(cc.Node)
    map_container: cc.Node = null

    // 迷雾瓦片容器
    @property(cc.Node)
    fov_container: cc.Node = null

    // 实体节点容器
    @property(cc.Node)
    entity_container: cc.Node = null

    // 图形节点容器
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

    // 寻路地图相关数据
    private mapData: MapData = null
    private astarGridhMesh: AStarGridMesh = null
    private mapOriSize: { width: number, height: number, scale: number } = { width: 1024 * 7, height: 1024 * 4, scale: 1 }

    // 视角跟随拖动相数据
    private isTouchMoving: boolean = false
    private cameraTargetPos: cc.Vec3 | null
    private cameraFollowBounds: cc.Rect | null = null

    protected start() {

        this.mapContainerCom = this.map_container.getComponent(MapContainer)
        this.fovContainerCom = this.fov_container.getComponent(FovContainer)
        this.entityContainerCom = this.entity_container.getComponent(EntityContainer)
        this.graphicsContainerCom = this.graphics_container.getComponent(GraphicsContainer)

        // 相机跟随
        const boundsW = 100 / this.mapOriSize.scale
        const boundsH = 600 / this.mapOriSize.scale
        const viewportCenterPos = this.viewPort.convertToWorldSpaceAR(cc.v2(0, 0))
        this.cameraFollowBounds = cc.rect(viewportCenterPos.x - boundsW / 2, viewportCenterPos.y - boundsH / 2, boundsW, boundsH)
        this.cameraTargetPos = this.map_container.position.clone()

        // 地图四叉树
        console.time("MapQuadTree")
        this.mapContainerCom.initMapQuadTree(this.mapOriSize)
        console.timeEnd("MapQuadTree")

        // 迷雾四叉树
        console.time("FovQuadTree")
        this.fovContainerCom.initFovQuadTree(this.mapOriSize)
        console.timeEnd("FovQuadTree")

        // astar寻路网格
        cc.resources.load("mapData", cc.JsonAsset, (err, data) => {
            console.time("astarGridMesh")
            this.mapData = data.json as MapData
            this.astarGridhMesh = AStarGridMesh.getInstance().reset(this.mapData)
            this.graphicsContainerCom.drawMapMesh()
            console.timeEnd("astarGridMesh")
        })

        // 地图触摸相关事件监听
        this.initEventListener()

        // 首次地图可视范围更新
        this.scheduleOnce(this.updateVisibleTiles.bind(this), 0.1)
    }

    private initEventListener() {

        this.viewPort.on(cc.Node.EventType.TOUCH_MOVE, (event: cc.Event.EventTouch) => {

            if (event.touch.getDelta().mag() == 0) return

            this.isTouchMoving = true

            const moveingDelt = event.touch.getDelta()
            const targetPosX = this.map_container.x + moveingDelt.x * 35
            const targetPosY = this.map_container.y + moveingDelt.y * 35

            const mapW = this.mapOriSize.width * this.mapOriSize.scale
            const mapH = this.mapOriSize.height * this.mapOriSize.scale

            // 边界判断,因项目适配宽度,不同设备高度不同,这里取屏幕高度做判断
            if (Math.abs(targetPosX) <= mapW / 2 - this.viewPort.width / 2) {
                this.cameraTargetPos.x = targetPosX
            }

            if (Math.abs(targetPosY) <= mapH / 2 - this.viewPort.height / 2) {
                this.cameraTargetPos.y = targetPosY
            }
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

                const result = this.astarGridhMesh.findPath(cc.v2(Math.ceil(entityPos.x), Math.ceil(entityPos.y)), cc.v2(Math.ceil(mapPos.x), Math.ceil(mapPos.y)), (block) => {
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
                this.graphicsContainerCom.drawMapMesh()
            }

            // 坐标显示
            if (!this.isTouchMoving) {
                const mapPos = this.map_container.convertToNodeSpaceAR(event.getLocation())
                const block = this.astarGridhMesh.getBlockByPos(mapPos)
                const blockPos = this.astarGridhMesh.getPosByBlock(block)
                this.lbl_pos.getComponent(cc.Label).string = `(${Math.ceil(mapPos.x)},${Math.ceil(mapPos.y)})\n(${block.x},${block.y})\n(${blockPos.x},${blockPos.y})`
            }

            this.updateVisibleTiles()
            this.isTouchMoving = false
        }, this)

        this.viewPort.on(cc.Node.EventType.TOUCH_CANCEL, (event: cc.Event.EventTouch) => {
            this.isTouchMoving = false
        }, this)

        this.viewPort.on(cc.Node.EventType.MOUSE_WHEEL, (event: cc.Event.EventMouse) => {
            const scale = event.getScrollY() > 0 ? Number((this.mapOriSize.scale + 0.1).toFixed(1)) : Number((this.mapOriSize.scale - 0.1).toFixed(1))
            this.updateMapScaleThrottle(scale)
        })

        this.btn_edit.on(cc.Node.EventType.TOUCH_END, (event: cc.Event.EventTouch) => {
            if (this.isEditing) {
                this.graphicsContainerCom.drawMapMesh()
                outPutJsonFile(this.mapData)
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

    /**
     * 平滑插值更新相机位置(手动拖动)
     * @param dt 
     * @returns 
     */
    private updateCameraPos(dt: number) {

        if (this.cameraTargetPos.sub(this.map_container.position).mag() == 0) return

        if (this.cameraTargetPos.sub(this.map_container.position).mag() <= 1) {
            this.cameraTargetPos = this.map_container.position.clone()
            return
        }

        this.map_container.position = this.map_container.position.lerp(this.cameraTargetPos, 0.05)
        this.graphics_container.position = this.graphics_container.position.lerp(this.cameraTargetPos, 0.05)
        this.entity_container.position = this.entity_container.position.lerp(this.cameraTargetPos, 0.05)
        this.fov_container.position = this.fov_container.position.lerp(this.cameraTargetPos, 0.05)
        this.updateVisibleTilesThrottle()
    }

    /**
     * 平滑插值更新相机位置(自动跟随)
     * @param dt 
     * @returns 
     */
    private updateCameraFollow(dt: number) {

        if (this.entityContainerCom.getEntity("entity_start").state != EntityState.MOVING) return

        const entityPos = this.entityContainerCom.getEntity("entity_start").getPosition()
        const entityWorldPos = this.map_container.convertToWorldSpaceAR(entityPos)
        const viewportCentPos = this.viewPort.convertToWorldSpaceAR(cc.v2(0, 0))


        if (!this.cameraFollowBounds.contains(entityWorldPos)) {
            const delta = Math.min((dt * 1000) / (1000 / this.mapOriSize.scale), 1)
            const offsetPos = cc.v2(viewportCentPos.x - entityWorldPos.x, viewportCentPos.y - entityWorldPos.y)

            if (!offsetPos.equals(cc.Vec2.ZERO)) {
                // 极限情况，真实位置永远趋近于目标影子位置，当相离位置小于0.5像素时直接修正到目标影子位置
                const interpolationX = Math.abs(offsetPos.x) <= 0.5 ? offsetPos.x : delta * offsetPos.x
                const interpolationY = Math.abs(offsetPos.y) <= 0.5 ? offsetPos.y : delta * offsetPos.y
                this.map_container.position = this.map_container.position.add(cc.v3(interpolationX, interpolationY, 0))
                this.graphics_container.position = this.graphics_container.position.add(cc.v3(interpolationX, interpolationY, 0))
                this.entity_container.position = this.entity_container.position.add(cc.v3(interpolationX, interpolationY, 0))
                this.cameraTargetPos = this.entity_container.position
                this.updateVisibleTilesThrottle()
            }
        }



    }

    /**
     * 更新可视地图、迷雾瓦片(立即)
     */
    private updateVisibleTiles() {

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

    /**
     * 更新可视地图、迷雾瓦片(节流)
     */
    @throttle(500)
    private updateVisibleTilesThrottle() {

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

    /**
     * 更新地图缩放(立即)
     * @param scale 
     * @returns 
     */
    private updateMapScale(scale: number) {
        if (scale <= 0.5 || scale >= 2) return
        this.mapContainerCom.setScale(scale)
        this.entityContainerCom.setScale(scale)
        this.graphicsContainerCom.setScale(scale)
        this.mapOriSize.scale = scale
        this.updateVisibleTiles()
    }

    /**
     * 更新地图缩放(节流)
     * @param scale 
     * @returns 
     */
    @throttle(50)
    private updateMapScaleThrottle(scale: number) {
        if (scale <= 0.5 || scale >= 2) return

        // 更新相关容器缩放
        this.mapContainerCom.setScale(scale)
        this.entityContainerCom.setScale(scale)
        this.graphicsContainerCom.setScale(scale)

        // 更新相关容器位置
        const prePos = this.map_container.position.clone()
        const preScale = this.mapOriSize.scale

        const rollBackDelta = (1 + (scale - preScale) / preScale)
        const rollBackPos = cc.v3(prePos.x * rollBackDelta, prePos.y * rollBackDelta)

        this.map_container.position = rollBackPos
        this.graphics_container.position = rollBackPos
        this.entity_container.position = rollBackPos
        this.fov_container.position = rollBackPos
        this.cameraTargetPos = rollBackPos

        // 更新可视瓦片
        this.mapOriSize.scale = scale
        this.updateVisibleTiles()
    }


    protected update(dt: number): void {
        this.updateCameraPos(dt)
        this.updateCameraFollow(dt)
    }
}
