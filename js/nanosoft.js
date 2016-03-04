var controllerIdCounter = 0;
var droneIdCounter = 0;
var latchPointIdCounter = 0;
var roamPointIdCounter = 0;

var inited = false;

// constants
var enableDroneLines = true;
var moveValue = 4;
var moveActionerInterval = 20;
var damageActionerInterval = 400;
var controllerCatchment = 300;
var damageDone = 8;
var targetSelector = 'div, span, img, p, a, ul, input, textarea';

function startGame() {
	initTargets();
	// generate a controller and x drones
	controllerWorker.generateController();
	for (var i=0; i < 10; i++) {
		generateDrone();
	}
	
	controllerWorker.generateController();
	controllerWorker.generateController();
}

var controllerWorker = {
	generateController : function() {
		initTargets();
		var newControllerId = getControllerIdStr(controllerIdCounter);
		$('body').append('<div class="nanosoft controller" id="' + newControllerId + '"/>');
		var newController = $('#' + newControllerId);
		
		newController.offset(calcRandomStartOffset());
		//newController.offset({ left: 400, top: 460 });
		setTarget(newController);
		
		//setInterval(function() { controllerActioner(newController); }, moveActionerInterval);
		newController.data('actionerId', setInterval(function() { controllerActioner(newController); }, moveActionerInterval));
		
		/*setTimeout(function() {
			controllerActioner(newController);
		}, 300);*/
		
		controllerIdCounter++;
	}
};

function controllerActioner(controller) {
	
	// find nearest next target element - for now hard code - only set new target if one not aquired
	
	var latched = false;
	var calling = controller.hasClass('controllerCalling');
	var potentiallyLatched = false;
	
	if (controller.hasClass('controllerLatched')) {
		latched = true;
	}
	
	// if latched figure out next step(s) - start calling drones; continue calling drones; do damage;
	// if not latched move towards the nearest next target element
	if (latched) {
		//console.log('ctrl is latched');
		if (!calling) {
			//console.log('ctrl is not calling');
			// find all roaming drones within 200px of controller
			// add droneTargetAqd  class to them and set their target
			var ctrlPosMetrics = getjQObjPosMetrics(controller);
			var controllersTarget = controller.data('target');
			var dronesBeingCalledCount = 0;
			$('.droneStd').each(function(index) {
				//console.log('drone index: ' + index);
				var drone = $(this);
				var dronePosMetrics = getjQObjPosMetrics(drone);
				if (Math.abs(ctrlPosMetrics.vCenter - dronePosMetrics.vCenter) <= controllerCatchment) {
					if (Math.abs(ctrlPosMetrics.hCenter - dronePosMetrics.hCenter) <= controllerCatchment) {
						if (null == drone.data('latchPoint') && !drone.hasClass('droneLatched')) {
							// drone is roaming and in catchment area
							//setTarget(drone);
							// set latch point ensuring we use the same target as the controller
							setLatchPointOnTarget(drone, controllersTarget);
							drone.addClass('droneTargetAqd');
							//connectNanoSoftToTarget(drone, controllersTarget);
							connectNanoSoftToTarget(drone, controller);
							dronesBeingCalledCount++;
						}
					}
				}
			});
			
			if (0 == dronesBeingCalledCount) {
				// destroy this ns as its useless
				destroyNanoSoft(controller);
			}
			else {
				controllersTarget.addClass('targetHasLatchedNS');
			}
		
			controller.addClass('controllerCalling');
		}
	}
	else {
		var targetLatchPoint = controller.data('latchPoint');
		var vMovement = calcNanoSoftMovement(targetLatchPoint.top, controller.offset().top, controller.height());
		var hMovement = calcNanoSoftMovement(targetLatchPoint.left, controller.offset().left, controller.width());	
		
		controller.offset({left: hMovement.leftOrTop, top: vMovement.leftOrTop});
		
		if (vMovement.arrived && hMovement.arrived) {
			controller.addClass('controllerLatched');
		}
	}
}

function generateDrones(count) {
	for (var i=0; i < count; i++) {
		generateDrone();
	}
}
function generateDrone() {
	initTargets();
	var newDroneId = getDroneIdStr(droneIdCounter);
	$('body').append('<div class="nanosoft droneStd" id="' + newDroneId + '"/>');
	var newDrone = $('#' + newDroneId);
	
	newDrone.offset(calcRandomStartOffset());
	//newController.offset({ left: 400, top: 460 });
	setRoamingTarget(newDrone);
	newDrone.data('latchPoint', null);
	
	newDrone.data('actionerId', setInterval(function() { droneMoveActioner(newDrone); }, moveActionerInterval));
	
	droneIdCounter++;
}
function disconnectNanoSoft(ns) {
	var eleId = ns.attr('id');
	if (enableDroneLines) { jsPlumb.detachAllConnections(eleId); }
}
function connectNanoSoftToTarget(ns, target) {
	var nsEleId = ns.attr('id');
	var targetEleId = target.attr('id');
	if (enableDroneLines) { jsPlumb.connect({ source: nsEleId, target: targetEleId }); }
}
function droneMoveActioner(drone) {
	
	// find nearest next target element - for now hard code - only set new target if one not aquired
	
	var latched = false;
	var potentiallyLatched = false;
	
	if (drone.hasClass('droneLatched')) {
		latched = true;
	}
	
	// if latched figure out next step(s) - do damage;
	// if not latched move towards the nearest next target element
	if (latched) {
		//var target = drone.data('target');
		//doDamage(drone, target);
		
		// stop this poller and start the much slower damage poller
		clearInterval(drone.data('actionerId'));
		drone.data('actionerId', setInterval(function() { droneLatchedActioner(drone); }, damageActionerInterval));
	}
	else {
		
		var roaming = !drone.hasClass('droneTargetAqd');
		var point = null;
		var target = null;
		var targetIsDead = false;
		
		if (roaming) {
			point = drone.data('roamPoint');
		}
		else {
			point = drone.data('latchPoint');
			target = drone.data('target');
			damData = target.data('damageData');
			targetIsDead = damData.isDead;
		}
		
		if (targetIsDead) {
			disengageDroneFromTarget(drone);
		}
		else {
			var vMovement = calcNanoSoftMovement(point.top, drone.offset().top, drone.height());
			var hMovement = calcNanoSoftMovement(point.left, drone.offset().left, drone.width());
			
			/*if (!roaming) { disconnectNanoSoft(drone); }*/
			drone.offset({left: hMovement.leftOrTop, top: vMovement.leftOrTop});
			if (enableDroneLines) { if (!roaming) { jsPlumb.repaint(drone.attr('id')); } }
			/*if (!roaming) { connectNanoSoftToTarget(drone, target); }*/
			
			if (vMovement.arrived && hMovement.arrived) {
				if (roaming) {
					// set new random roaming x y
					setRoamingTarget(drone);
				}
				else {
					disconnectNanoSoft(drone);
					drone.addClass('droneLatched');
					drone.removeClass('droneTargetAqd');
				}
			}
		}
	}
}
function droneLatchedActioner(drone) {
	var target = drone.data('target');
	var damData = target.data('damageData');
	
	if (!damData.isDead) {
		doDamage(drone, target);
	}
	else {
		disengageDroneFromTarget(drone);
		clearInterval(drone.data('actionerId'));
		drone.data('actionerId', setInterval(function() { droneMoveActioner(drone); }, moveActionerInterval));
	}
}
function disengageDroneFromTarget(drone) {
	disconnectNanoSoft(drone);
	drone.data('target', null);
	drone.data('latchPoint', null);
	drone.removeClass('droneLatched');
	drone.removeClass('droneTargetAqd');
}

function setRoamingTarget(ns) {
	var point = {
		top: (Math.floor(Math.random() * $('body').height())),
		left: (Math.floor(Math.random() * $('body').width()))
	};
	ns.data('roamPoint', point);
	//renderPoint(roamPointIdCounter, getRoamPointIdStr, 'roamPoint', point);
	roamPointIdCounter++;
}

var targets = {};
function initTargets() {

	if (inited) {
		return;
	}

	var targetCount = identTargets_Recur($('body').find(targetSelector));

	targets.targetCount = targetCount;
	//console.log(targets);
	/*for (var i = 0; i < targets.targetCount; i++) {
		console.log('target id: ' + i);
		var target = targets[i];
		console.log(target);
	}*/
	inited = true;
	//setDamageData($('#firstDiv'));
	//setDamageData($('#secDiv'));
}
function identTargets_Recur(list) {
	var targetCount = 0;
	list.each(function(index) {
		var target = $(this);
		
		if (target.is(':visible')) {
			//targetCount += identTargets_Recur(target.children(targetSelector));
		
			setDamageData(target);
			/*console.log('targets data:');
			console.log(target.data('damageData'));
			console.log('targetCount: ' + targetCount);*/
			target.addClass('target');
			targets[targetCount] = target;
			//console.log('target: ' + targetCount);
			//console.log(targets[targetCount]);
			targetCount++;
		}		
	});
	return targetCount;
}
/*function identTargets_Recur(list) {
	var targetCount = 0;
	list.each(function(index) {
		var target = $(this);
		
		if (target.is(':visible')) {
			//targetCount += identTargets_Recur(target.children(targetSelector));
		
			setDamageData(target);
			/*console.log('targets data:');
			console.log(target.data('damageData'));
			console.log('targetCount: ' + targetCount);/
			target.addClass('target');
			targets[targetCount] = target;
			console.log('target: ' + targetCount);
			console.log(targets[targetCount]);
			targetCount++;
		}		
	});
	return targetCount;
}*/

function setTarget(ns) {
	
	/*var target = $('#firstDiv');
	if (50 > (Math.floor(Math.random() * 101))) {
		var target = $('#secDiv');
	}*/
	
	var rndNum = (Math.floor(Math.random() * targets.targetCount));
	var target = targets[rndNum];
	
	while (target == null || target == undefined) {
		rndNum = (Math.floor(Math.random() * targets.targetCount));
		target = targets[rndNum];
	}
	
	if (target.data('damageData').isDead) {
		target = null;
		for (var i = 0; i < targets.targetCount; i++) {
			var damData = targets[i].data('damageData');
			if (!damData.isDead) {
				target = targets[i];
				break;
			}
		}
	}
	
	if (null == target) {
		alert('no more targets!');
	}
	
	setLatchPointOnTarget(ns, target);
	//return target;
}

function setLatchPointOnTarget(ns, target) {
	
	var nsPosMetrics = getjQObjPosMetrics(ns);
	var targetPosMetrics = getjQObjPosMetrics(target);
	
	var latchPoint = {
		top: 0,
		left: 0
	};
	
	//latchPoint.width = targetPosMetrics.width;
	//latchPoint.height = targetPosMetrics.height;
	
	// work out which is closest left, right, top or bottom
	//var closestEdgeData = getTargetsCosestEdge(ns, target);
	var oriMets = getOrientationMetrics(nsPosMetrics, targetPosMetrics);
	
	//console.log(closestEdgeData);
	
	if (oriMets.closestEdge == 'top') {
		//console.log('top is closest');
		latchPoint.top = targetPosMetrics.top;
		var rndNum = (Math.floor(Math.random() * targetPosMetrics.width));
		latchPoint.left = targetPosMetrics.left + rndNum;
	}
	else if (oriMets.closestEdge == 'bottom') {
		//console.log('bottom is closest');
		latchPoint.top = targetPosMetrics.bottom;
		var rndNum = (Math.floor(Math.random() * targetPosMetrics.width));
		latchPoint.left = targetPosMetrics.left + rndNum;
	}
	else if (oriMets.closestEdge == 'left') {
		//console.log('left is closest');
		// ns is left of target
		latchPoint.left = targetPosMetrics.left;
		var rndNum = (Math.floor(Math.random() * targetPosMetrics.height));
		latchPoint.top = targetPosMetrics.top + rndNum;
	}
	else if (oriMets.closestEdge == 'right') {
		//console.log('right is closest');
		// ns is left of target
		latchPoint.left = targetPosMetrics.right;
		var rndNum = (Math.floor(Math.random() * targetPosMetrics.height));
		latchPoint.top = targetPosMetrics.top + rndNum;
	}
	else {
		//console.log('NONE is closest');
		latchPoint.top = target.offset().top;
		latchPoint.left = target.offset().left;
	}
	
	ns.data('latchPoint', latchPoint);
	ns.data('target', target);
	
	//renderPoint(latchPointIdCounter, getLatchPointIdStr, 'latchPoint', latchPoint);
	latchPointIdCounter++;
}

function setDamageData(target) {
	var damData = {
		startLife: 1000,
		remainingLife: 1000,
		isDead: false
	};
	target.data('damageData', damData);
}
function doDamage(ns, target) {
	var damageData = target.data('damageData');
	
	damageData.remainingLife -= damageDone;
	
	ns.addClass('doingDamage');
	setTimeout(function() { ns.removeClass('doingDamage'); }, 300);
	
	if (damageData.remainingLife <= 0) {
		// target is dead
		damageData.isDead = true;
		target.removeClass('target');
		target.addClass('deadTarget');
		
		// destroy any controllers that were latched on
		$('.controller').each(function(index) {
			var ctrlTarget = $(this).data('target');
			if (ctrlTarget == target) {
				destroyNanoSoft($(this));
			}
		});
		// destroy the target ele
		destroyTarget(target);
	}
	
	target.data('damageData', damageData);
}
function destroyNanoSoft(ns) {
	// clear intervals
	clearInterval(ns.data('actionerId'));
	// remove from dom
	setTimeout(function() { ns.remove(); }, 100);
	
	//ns.hide();
}
function destroyTarget(target) {
	/*if (target.children().length == 0) {
		target.remove();
	}
	else {
		target.text('');
		target.contents().unwrap();
	}*/
	//target.text('');
	if (target.children().length == 0) {
		target.text('');
	}
	target.contents().unwrap();
	//target.hide();
}

function renderPoint(counter, newIdFunc, cssClass, point) {
	var newPId = newIdFunc(counter);
	//console.log('### newPId: ' + newPId);
	$('body').append('<div class="' + cssClass + '" id="' + newPId + '"/>');
	var newP = $('#' + newPId);
	newP.offset({ top: convertTopLeftCoordsToCentered(point.top, newP.height()), left: convertTopLeftCoordsToCentered(point.left, newP.width()) });
}
function convertTopLeftCoordsToCentered(leftOrTop, heightOrWidth) {
	return leftOrTop - (heightOrWidth / 2);
}

function getOrientationMetrics(nsPosMetrics, targetPosMetrics) {

	var oriMetrics = {
		vOri: null,
		hOri: null,
		closestEdge: null
	};

	if (nsPosMetrics.bottom < targetPosMetrics.top) {
		oriMetrics.vOri = 'above';
	}
	else if (nsPosMetrics.top > targetPosMetrics.bottom) {
		oriMetrics.vOri = 'below';
	}
	
	if (nsPosMetrics.right < targetPosMetrics.left) {
		oriMetrics.hOri = 'left';
	}
	else if (nsPosMetrics.left > targetPosMetrics.right) {
		oriMetrics.hOri = 'right';
	}
	
	//console.log('oriMetrics.vOri: ' + oriMetrics.vOri);
	//console.log('oriMetrics.hOri: ' + oriMetrics.hOri);
	//console.log('both null: ' + (oriMetrics.vOri == null && oriMetrics.hOri == null));
	
	var vDiff = Math.abs(nsPosMetrics.hCenter - targetPosMetrics.hCenter);
	var hDiff = Math.abs(nsPosMetrics.vCenter - targetPosMetrics.vCenter);
	
	//console.log('vDiff: ' + vDiff);
	//console.log('hDiff: ' + hDiff);
	
	if (oriMetrics.vOri == 'above' && oriMetrics.hOri == null) {
		oriMetrics.closestEdge = 'top';
	}
	else if (oriMetrics.vOri == 'below' && oriMetrics.hOri == null) {
		oriMetrics.closestEdge = 'bottom';
	}
	else if (oriMetrics.hOri == 'left' && oriMetrics.vOri == null) {
		oriMetrics.closestEdge = 'left';
	}
	else if (oriMetrics.hOri == 'right' && oriMetrics.vOri == null) {
		oriMetrics.closestEdge = 'right';
	}
	else {
		if (vDiff > hDiff) {
			// top or bottom is closer
			if (oriMetrics.vOri == 'above') {
				oriMetrics.closestEdge = 'top';
			}
			else {
				oriMetrics.closestEdge = 'bottom';
			}
		}
		else {
			// left or right is closer
			if (oriMetrics.hOri == 'left') {
				oriMetrics.closestEdge = 'left';
			}
			else {
				oriMetrics.closestEdge = 'right';
			}
		}
	}
	
	return oriMetrics;
}

function getjQObjPosMetrics(obj) {
	return {
		top: obj.offset().top,
		left: obj.offset().left,
		bottom: obj.offset().top + obj.height(),
		right: obj.offset().left + obj.width(),
		hCenter: getCenter(obj.offset().top, obj.height()),
		vCenter: getCenter(obj.offset().left, obj.width()),
		height: obj.height(),
		width: obj.width()
	};
}
function getCenter(topOrLeft, heightOrWidth) {
	return topOrLeft + (heightOrWidth / 2);
}

function calcNanoSoftMovement(latchPointVOrH, nsLeftOrTop, nsWidthOrHeight) {

	// move towards latchPoint - don't overrun - don't move any closer when inline
	if (latchPointVOrH < nsLeftOrTop) {
		// move left/up - NanoSoft is to the right or below of the element
		var proposedNewPos = nsLeftOrTop - moveValue;
		if (proposedNewPos < latchPointVOrH) {
			return {
				leftOrTop: latchPointVOrH,
				arrived: true
			}
		}
		else {
			return {
				leftOrTop: proposedNewPos,
				arrived: false
			}
		}
	}
	else if (latchPointVOrH > nsLeftOrTop) {
		// move right/down - NanoSoft is to the left or above of the element
		var proposedNewPos = nsLeftOrTop + moveValue;
		if ((proposedNewPos + nsWidthOrHeight) > latchPointVOrH) {
			return {
				leftOrTop: latchPointVOrH - nsWidthOrHeight,
				arrived: true
			}
		}
		else {
			return {
				leftOrTop: proposedNewPos,
				arrived: false
			}
		}
	}
	else {
		return {
			leftOrTop: nsLeftOrTop,
			arrived: true
		}
	}
}

/*function calcNanoSoftMovement(targetLeftOrTop, targetWidthOrHeight, nsLeftOrTop, nsWidthOrHeight) {

	//var rndNum = (Math.floor(Math.random()*targetWidthOrHeight));
	/*var rndNum = 30;
	
	var targetLeftOrTopRnd = targetLeftOrTop + rndNum;
	var targetWidthOrHeightRnd = targetWidthOrHeight - rndNum;/

	// move left or right - figure out if the NanoSoft is to the left or right of the element
	if (targetLeftOrTop < nsLeftOrTop) {
		// move left/up - NanoSoft is to the right or below of the element
		var nanoSoftLeftOrTop = nsLeftOrTop;
		var targetRightOrBottom = targetLeftOrTop + targetWidthOrHeight;
		
		var proposedNewLeftOrTop = nanoSoftLeftOrTop - moveValue;
		
		if (proposedNewLeftOrTop < targetRightOrBottom) {
			// this would have moved us to inside the div so set the left to the same
			//nsOffset({left: targetRight, top: nsOffset.top});
			return {
				leftOrTop: targetRightOrBottom,
				collision: true
			}
		}
		else {
			//controller.offset({left: proposedNewLeft, top: controller.offset().top});
			return {
				leftOrTop: proposedNewLeftOrTop,
				collision: false
			}
		}
	}
	else if (targetLeftOrTop > nsLeftOrTop) {
		// move right/down - NanoSoft is to the left or above of the element
		var nanoSoftRightOrBottom = nsLeftOrTop + nsWidthOrHeight;
		
		var proposedNewRightOrBottom = nanoSoftRightOrBottom + moveValue;
		
		if (proposedNewRightOrBottom > targetLeftOrTop) {
			// this would have moved us to inside the div so set the top to the same
			return {
				leftOrTop: targetLeftOrTop - nsWidthOrHeight,
				collision: true
			}
		}
		else {
			return {
				leftOrTop: nsLeftOrTop + moveValue,
				collision: false
			}
		}
	}
	else {
		return {
			leftOrTop: nsLeftOrTop,
			collision: true
		}
	}
}*/

/*function calcNanoSoftMovement(targetLeftOrTop, targetWidthOrHeight, nsLeftOrTop, nsWidthOrHeight) {

	var rndNum = (Math.floor(Math.random()*targetWidthOrHeight));
	
	/*if (50 > rndNum) {
		return {
			leftOrTop: nsLeftOrTop,
			collision: false
		}
	}/
	
	var targetLeftOrTopRnd = targetLeftOrTop + rndNum;
	var targetWidthOrHeightRnd = targetWidthOrHeight - rndNum;

	// move left or right - figure out if the NanoSoft is to the left or right of the element
	if (targetLeftOrTop < nsLeftOrTop) {
		// move left/up - NanoSoft is to the right or below of the element
		var nanoSoftLeftOrTop = nsLeftOrTop;
		var targetRightOrBottom = targetLeftOrTop + targetWidthOrHeight;
		
		var proposedNewLeftOrTop = nanoSoftLeftOrTop - moveValue;
		
		if (proposedNewLeftOrTop < targetRightOrBottom) {
			// this would have moved us to inside the div so set the left to the same
			//nsOffset({left: targetRight, top: nsOffset.top});
			return {
				leftOrTop: targetRightOrBottom,
				collision: true
			}
		}
		else {
			//controller.offset({left: proposedNewLeft, top: controller.offset().top});
			return {
				leftOrTop: proposedNewLeftOrTop,
				collision: false
			}
		}
	}
	else if (targetLeftOrTop > nsLeftOrTop) {
		// move right/down - NanoSoft is to the left or above of the element
		var nanoSoftRightOrBottom = nsLeftOrTop + nsWidthOrHeight;
		
		var proposedNewRightOrBottom = nanoSoftRightOrBottom + moveValue;
		
		if (proposedNewRightOrBottom > targetLeftOrTop) {
			// this would have moved us to inside the div so set the top to the same
			return {
				leftOrTop: targetLeftOrTop - nsWidthOrHeight,
				collision: true
			}
		}
		else {
			return {
				leftOrTop: nsLeftOrTop + moveValue,
				collision: false
			}
		}
	}
	else {
		return {
			leftOrTop: nsLeftOrTop,
			collision: true
		}
	}
}*/

function getRandomResult() {
	return 50 > (Math.floor(Math.random()*100 + 1));
}

function calcRandomStartOffset(nsHeight, nsWidth) {
	if (50 > (Math.floor(Math.random()*100 + 1))) {
		// use left and top
		if (50 > (Math.floor(Math.random()*100 + 1))) {
			// use left
			return {
				top: 0,
				left: Math.floor(Math.random()*$('body').width())
			};
		}
		else {
			// use top
			return {
				top: Math.floor(Math.random()*$('body').height()),
				left: 0
			};
		}
	}
	else {
		// use right and bottom
		if (50 > (Math.floor(Math.random()*100 + 1))) {
			// use bottom
			return {
				left: Math.floor(Math.random()*$('body').width()),
				top: $('body').height()
			};
		}
		else {
			// use right
			return {
				left: $('body').width(),
				top: Math.floor(Math.random()*$('body').height())
			};
		}
	}
	
}

function getControllerIdStr(counter) {
	return 'controller' + counter;
}
function getDroneIdStr(counter) {
	return 'drone' + counter;
}
function getLatchPointIdStr(counter) {
	return 'lp' + counter;
}
function getRoamPointIdStr(counter) {
	return 'roamp' + counter;
}