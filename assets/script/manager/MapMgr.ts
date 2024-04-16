


export class MapMgr {


    private static mapTilSize: cc.Vec2 = cc.v2(1024, 1024)
    private static mapOriSize: cc.Vec2 = cc.v2(1024 * 7, 1024 * 4)

    private static mapTilIdx2Rect: Map<number, cc.Rect> = new Map()

    public static initMap(mapTilNodes: Array<cc.Node>) {
    }

    public static getTileIdxByViewPortRect(viewPortRect: cc.Rect): Array<number> {
        return []
    }
}