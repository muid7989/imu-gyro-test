let time;
let frameCountBuffer = 0;
let fps = 0;

const CANVAS_W = 640;
const CANVAS_H = 832;

const GRID_SIZE = 64;

const BUTTON_OFFSET = 0;
const BUTTON_W = GRID_SIZE*3;
const BUTTON_H = GRID_SIZE*2;
const BUTTON_X = GRID_SIZE*0;
const BUTTON_Y = CANVAS_H-GRID_SIZE*3;
const BUTTON_M = GRID_SIZE*0.5;

// for M5
const NAME_PRE = 'UART';
const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
let bleDevice;
let rxCharacteristic;
let isConnected;
let dataCount;
let dataRate;
let val = [];

let connectButton, startButton, calButton;

let dataBuf = [];
let dataIndex;
const DATA_SIZE = 200;
let drawIndex;
let logFlag;
let idCheck = 0;
let lossCount = 0;
let outputBuf = [];
let outputIndex;
let dataTime;
let prevTime;

let calFlag = false;
//let xGyAvr, yGyAvr, zGyAvr, xGyVal, yGyVal, zGyVal;
//let xAvrSum, xAvrCount, yAvrSum, yAvv;
let avrCount;
let avrSum = [];
let avrVal = [];
const AVR_NUM = 3;
const AVR_COUNT = 200;
let xSpeed, ySpeed, zSpeed;
let xPos, yPos, zPos;
let prevXPos, prevYPos, prevZPos, prevInt;
//const POS_EF = 0.95;
const GY_EF = 0.0001;
const CX = GRID_SIZE*1.5;
const CY = GRID_SIZE*4;

let ball;

const LOG_W = GRID_SIZE*7;
const LOG_H = GRID_SIZE*4;
const LOG_X = GRID_SIZE*3;
const LOG_OFFSET = 10;
const LOG_POINT_SIZE = 2;
const LOG_MOVE_X = 1;
let logGraph = [
	{
		x: LOG_X,
		y: GRID_SIZE*0,
		width: LOG_W,
		height: GRID_SIZE*2,
		offset: GRID_SIZE*1,
		max: 30000,
		color: 'red',
		drawX: 0,
	},
	{
		x: LOG_X,
		y: GRID_SIZE*2,
		width: LOG_W,
		height: GRID_SIZE*4,
		offset: GRID_SIZE*0,
		max: 300,
		color: 'blue',
		drawX: 0,
	},
	{
		x: LOG_X,
		y: GRID_SIZE*6,
		width: LOG_W,
		height: GRID_SIZE*4,
		offset: 0,
		max: 300,
		color: 'yellow',
		subColor: 'green',
		drawX: 0,
	},
];

const DEBUG = true;
const DEBUG_VIEW_X = 20;
const DEBUG_VIEW_Y = 20;
const DEBUG_VIEW_H = 20;

function preload() {
}
function graphSetup( graph ){
	graph.graphics = createGraphics(graph.width, graph.height);
	graph.graphics.clear();
	graph.graphics.background(0);
	graph.graphics.strokeWeight(1);
	graph.graphics.stroke(255);
	graph.graphics.line(0, graph.height-graph.offset, graph.width, graph.height-graph.offset);
}

function setup() {
	createCanvas(CANVAS_W, CANVAS_H);
	frameRate(60);
	time = millis();
	rectMode(CENTER);

	for (let i=0; i<DATA_SIZE; i++){
		dataBuf[i] = [];
	}
	dataIndex = 0;
	isConnected = false;
	dataCount = 0;
	dataRate = 0;
	drawIndex = 0;
	logFlag = false;
	xPos = CX;
	yPos = CY;
	xSpeed = 0;
	ySpeed = 0;
	zSpeed = 0;

	startButton = buttonInit('start', BUTTON_W, BUTTON_H, BUTTON_X, BUTTON_Y);
	startButton.mousePressed(startFn);
	connectButton = buttonInit('connect', BUTTON_W, BUTTON_H, BUTTON_X+BUTTON_M+BUTTON_W, BUTTON_Y);
	connectButton.mousePressed(connectToBle);
	calButton = buttonInit('cal', BUTTON_W, BUTTON_H, BUTTON_X+(BUTTON_M+BUTTON_W)*2, BUTTON_Y);
	calButton.mousePressed(calFn);

	for (let i=0; i<logGraph.length; i++){
		graphSetup(logGraph[i]);
	}
	for (let i=0; i<DATA_SIZE; i++){
		outputBuf[i] = [];
	}
	outputIndex = 0;
	ball = {};
	ball.x = CX;
	ball.y = CY;
	ball.size = 30;
	for (let i=0; i<AVR_NUM; i++){
		avrVal[i] = 0;
		avrSum[i] = 0;
	}
}
function buttonInit(text, w, h, x, y) {
	let button = createButton(text);
	button.size(w,h);
	button.position(x+BUTTON_OFFSET,y+BUTTON_OFFSET);
	button.style('font-size', '16px');
	return button;
}
function startFn() {
	if (logFlag){
		logFlag = false;
	}else{
		logFlag = true;
		dataTime = millis();
		calFn();
	}
}
function calFn() {
	calFlag = true;
	avrCount = 0;
	for (let i=0; i<AVR_NUM; i++){
		avrVal[i] = 0;
		avrSum[i] = 0;
	}
}
function drawGraph(graph, data) {
	graph.graphics.strokeWeight(LOG_POINT_SIZE);
	let tY = graph.height - data*(graph.height-graph.offset)/graph.max - graph.offset;
	graph.graphics.stroke(graph.color);
	graph.graphics.point(graph.drawX, tY);
	graph.drawX += LOG_MOVE_X;
	if (graph.drawX>=graph.width){
		graph.drawX = 0;
		graphSetup(graph);
	}
}
function drawGraphSub(graph, data) {
	graph.graphics.strokeWeight(LOG_POINT_SIZE);
	let tY = graph.height - data*(graph.height-graph.offset)/graph.max - graph.offset;
	graph.graphics.stroke(graph.subColor);
	graph.graphics.point(graph.drawX, tY);
}
function draw() {
	background(48);
	let current = millis();
	if ( (current-time)>=1000 ){
		time += 1000;
		fps = frameCount - frameCountBuffer;
		frameCountBuffer = frameCount;
		dataRate = dataCount;
		dataCount = 0;
	}
	if (DEBUG){
		stroke(128);
		strokeWeight(1);
		for (let i=0; i<CANVAS_H/GRID_SIZE; i++){
			line(0, i*GRID_SIZE, CANVAS_W, i*GRID_SIZE);
		}
		for (let i=0; i<CANVAS_W/GRID_SIZE; i++){
			line(i*GRID_SIZE, 0, i*GRID_SIZE, CANVAS_H);
		}
	}
	fill(255);
	textSize(16);
	stroke(255);
	strokeWeight(1);
	let debugY = DEBUG_VIEW_Y;
	text('fps:'+fps, DEBUG_VIEW_X, debugY);
	debugY += DEBUG_VIEW_H;
	text('dataRate'+':'+dataRate, DEBUG_VIEW_X, debugY);
	debugY += DEBUG_VIEW_H;
	text('cal:'+calFlag, DEBUG_VIEW_X, debugY);
	debugY += DEBUG_VIEW_H;
	text('x:'+int(ball.x)+', y:'+int(ball.y), DEBUG_VIEW_X, debugY);
	debugY += DEBUG_VIEW_H;
/*
	text('speed:'+xSpeed, DEBUG_VIEW_X, debugY);
	debugY += DEBUG_VIEW_H;
	text('pos:'+xPos, DEBUG_VIEW_X, debugY);
	debugY += DEBUG_VIEW_H;
*/
	text('loss:'+lossCount, DEBUG_VIEW_X, debugY);
	debugY += DEBUG_VIEW_H;
	for (let i=0; i<val.length; i++){
		text(avrVal[i], DEBUG_VIEW_X, debugY);
		debugY += DEBUG_VIEW_H;
	}
	if (logFlag){
//		outputBuf[outputIndex][0] = current - dataTime;
		for (let i=0; i<8; i++){
			if (drawIndex==dataIndex){
				console.log(current, dataTime);
				break;
			}
			if (current<dataTime){
				break;
			}
			prevInt = dataBuf[drawIndex][val.length-1];
			dataTime += prevInt;
			prevXPos = xPos;
			prevYPos = yPos;
			if (calFlag){
				for (let j=0; j<AVR_NUM; j++){
					avrSum[j] += dataBuf[drawIndex][j+6];
				}
				avrCount++;
				if (avrCount>=AVR_COUNT){
					calFlag = false;
					for (let j=0; j<AVR_NUM; j++){
						avrVal[j] = avrSum[j]/AVR_COUNT;
					}
				}
			}else{
				xSpeed = (dataBuf[drawIndex][6]-avrVal[0])*GY_EF;
				ySpeed = (dataBuf[drawIndex][7]-avrVal[1])*GY_EF;
				xPos += xSpeed;
				yPos += ySpeed;
			}
			dataBuf[drawIndex][val.length] = xPos;
			drawGraph(logGraph[0], dataBuf[drawIndex][2]);
			drawGraph(logGraph[1], dataBuf[drawIndex][val.length]);
			drawIndex++;
			if (drawIndex>=DATA_SIZE){
				drawIndex = 0;
			}
	//		console.log(current, dataTime);
		}
		if (current>dataTime){
			dataTime = current+20;
			console.log(drawIndex, dataIndex);
		}
		ball.x = xPos + (prevXPos-xPos)*(dataTime-current)/prevInt;
		ball.y = yPos + (prevYPos-yPos)*(dataTime-current)/prevInt;
		outputBuf[outputIndex][0] = ball.x;
		outputBuf[outputIndex][1] = current-prevTime;
//		outputBuf[outputIndex][1] = ball.x;
//		drawGraph(logGraphSpeed, outputBuf[outputIndex][0]);
		drawGraph(logGraph[2], outputBuf[outputIndex][0]);
//		drawGraph(logGraph[3], outputBuf[outputIndex][1]);
		drawGraphSub(logGraph[2], outputBuf[outputIndex][1]);
		prevTime = current;
		outputIndex++;
		if (outputIndex>=DATA_SIZE){
			outputIndex = 0;
		}
	}
	fill(255);
	noStroke();
//	circle(xPos, zPos, 50);
	circle(ball.x, ball.y, ball.size);
	stroke(255);
	strokeWeight(3);
	line(xPos, zPos, CX, CY);
//	image(logGraphXa.graphics, logGraphXa.x, logGraphXa.y);
//	image(logGraphSpeed.graphics, logGraphSpeed.x, logGraphSpeed.y);
//	image(logGraphPos.graphics, logGraphPos.x, logGraphPos.y);
	for (let i=0; i<logGraph.length; i++){
		image(logGraph[i].graphics, logGraph[i].x, logGraph[i].y);
	}
}
function writeBLE(val) {
	if (isConnected){
		const data = new Uint8Array([0x00,val]);
		rxCharacteristic.writeValue(data);
		console.log('Write data',data);
	}
}
async function connectToBle() {
	try {
		console.log("Requesting Bluetooth Device...");
		bleDevice = await navigator.bluetooth.requestDevice({
			filters: [{ namePrefix: NAME_PRE }],
			optionalServices: [UART_SERVICE_UUID]
		});
		console.log("Connecting to GATT Server...");
		const server = await bleDevice.gatt.connect();

		console.log("Getting Service...");
		const service = await server.getPrimaryService(UART_SERVICE_UUID);

		console.log("Getting Characteristics...");
		const txCharacteristic = await service.getCharacteristic(
			UART_TX_CHARACTERISTIC_UUID
		);
		txCharacteristic.startNotifications();
		txCharacteristic.addEventListener(
			"characteristicvaluechanged",
			e => {
				onTxCharacteristicValueChanged(e);
			}
		);
		rxCharacteristic = await service.getCharacteristic(
			UART_RX_CHARACTERISTIC_UUID
		);
		isConnected = true;
	} catch (error) {
		console.log(error);
	}
	function onTxCharacteristicValueChanged(event) {
		dataCount++;
		let receivedData = [];
//		let id = event.target.value.getUint16(0, true);
		for (let i=0; i<2; i++){
			receivedData[i] = event.target.value.getUint16(i*2, true);
		}
		for (let i=2; i<event.target.value.byteLength/2; i++){
			receivedData[i] = event.target.value.getInt16(i*2, false);
		}
		let id = receivedData[0];
		let senseInterval = (receivedData[1]-val[1])/10;
		if (receivedData[1]<val[1]){
			senseInterval = (50000+receivedData[1]-val[1])/10;
		}
//		console.log(id, receivedData);
		for (let i=0; i<receivedData.length; i++){
			val[i] = receivedData[i];
			dataBuf[dataIndex][i] = val[i];
		}
		val[receivedData.length] = senseInterval;
		dataBuf[dataIndex][receivedData.length] = senseInterval;
		if (idCheck!=id){
			idCheck = id+1;
			lossCount++;
		}else{
			idCheck++;
			if (idCheck>=65536){
				idCheck = 0;
			}
		}
		if (logFlag){
			dataIndex++;
			if (dataIndex>=DATA_SIZE){
				dataIndex = 0;
			}
		}
	}
}


