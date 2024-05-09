/*
 * @Author: hyrm 
 * @Date: 2024-04-27 17:54:52 
 * @Last Modified by: hyrm
 * @Last Modified time: 2024-05-03 02:06:02
 */

const { ccclass, property } = cc._decorator;


@ccclass
export default class ViewPort extends cc.Component {

    @property(cc.Node)
    camera_box: cc.Node = null

    protected start(): void {

    }

    protected update(dt: number): void {
        
    }
}


export type Entity = {
    shadowPos?: Array<cc.Vec2>
    curShadowPos?: cc.Vec2 | null
} & cc.Node
