type MapData = {
    mapWidth: number,
    mapHeight: number,
    nodeWidth: number,
    nodeHeight: number,
    roadDataArr: number[][],
}


type FovTileData = {
    id: number,
    value: number,
    node: cc.Node,
    owningRect: QuadTreeRect,
    tilePos: { x: number, y: number },
    unlock: boolean
}
