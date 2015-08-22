/**
 * Raytracer object to raytrace a world definition
 * @param {Object} config The configuration object
 *
 * @author  James Wake (SparkX120)
 * @version 0.1 (2015/08)
 * @license MIT
 */

class Raytracer{
	constructor(config){
		// this.camera = config.camera;
		this.world = config.world;

		this.world.some((e) => {if(e instanceof Camera){this.camera = e;};});
		if(!this.camera)
			throw "World Does not have a Camera!";

		this.pixelRenderer = config.pixelRenderer; //Must support function drawPixel({x, y, r, g, b, a});

		this.backgroundColor = {r: 0, g: 0, b: 0, a: 255};
		this.color = {r: 100, g: 100, b: 100, a: 255};

		this.falloffFactor = 10;

		this.drawTitle();
	}

	drawTitle(){
		var width  = this.pixelRenderer.width;
		var height = this.pixelRenderer.height;
		var ctx    = this.pixelRenderer.context;
		var x      = width  / 2;
      	var y1     = height * (1/3);
      	var y2     = height * (2/3);

		ctx.font = '30pt Helvetica,Arial,sans-serif';
		ctx.textAlign = 'center';
		ctx.fillStyle = 'Black';
		ctx.fillText('Raytracer-JS', x, y1);

		ctx.font = '15pt Helvetica,Arial,sans-serif';
		ctx.fillText('Version 0.0.1 By SparkX120', x, y2);

	}

	drawRenderingPlaceholder(){
		var width  = this.pixelRenderer.width;
		var height = this.pixelRenderer.height;
		var ctx    = this.pixelRenderer.context;
		var x      = width  / 2;
      	var y      = height / 2;

		ctx.fillStyle = 'rgba(255,255,255,1)';
		ctx.fillRect(0,0,width,height);

		this.progress       = document.createElement("progress");
		this.progress.max   = 100;
		this.progress.value = 0;
		this.progress.style.zindex          = "99";
		this.progress.style.width           = "100%";
		this.progress.style.height          = "3em";
		this.progress.style.bottom          = "50%";
		this.progress.style.position        = "absolute";
		this.progress.style.border          = "1px solid black";
		this.progress.className             = "prog";

		if(this.pixelRenderer.container)
			this.pixelRenderer.container.appendChild(this.progress);
	}

	getObjectList(){
		return this.world.filter((elem) => elem instanceof GenericObject);
	}

	getLightList(){
		return this.world.filter((elem) => elem instanceof Light);
	}

	render(){
		this.drawRenderingPlaceholder();

		//Give canvas time to update
		setTimeout(()=>{
			this.pixelRenderer.clearBuffer();
			this.camera.width = this.pixelRenderer.width;
			this.camera.height = this.pixelRenderer.height;
			this.camera.setupVectors();

			//Run outerloop in timeout so canvas can live update
			var i = 0;
			var timeout = setInterval(()=>{
				if(i<this.camera.y){ i++;
					for(var j=0; j<this.camera.x; j++){
						var ray   = new Ray({x: j, y:i, camera: this.camera});
						var color = this.raytrace(ray);
						var pixel = color;
						pixel.x = j;
						pixel.y = i;
						this.pixelRenderer.drawPixel(pixel);
					}
					// this.pixelRenderer.flushBuffer();

					//Update Progress Bar
					var progress = Math.floor((i/this.camera.y)*100);
					if(this.progress && this.progress.value != progress){
						this.progress.value = progress;
					}

				}else{
					//Get rid of the Progress Bar
					if(this.progress){
						this.pixelRenderer.container.removeChild(this.progress);
						this.progress = null;
					}
					// this.pixelRenderer.flushBuffer();
					clearTimeout(timeout);}
			}, 1);

			
		},10);
	}

	

	raytrace(ray){
		var objList   = this.getObjectList();
		var lightList = this.getLightList();

		objList.map((obj)=>{
			obj.rayIntersect(ray);
		});

		if(ray.intersectedObject){
			var object = ray.lowestIntersectObject;

			var ambientFactor  = object.ambientFactor;
			var diffuseFactor  = object.diffuseFactor;
			var specularFactor = object.specularFactor;

			var ambientColor   = object.ambientC;
			var diffuseColor   = {r:0,g:0,b:0,a:0};
			var specularColor  = {r:0,g:0,b:0,a:0};

			if(this.getLightList()){
				diffuseColor   = this._diffuseShader(ray);
				specularColor  = this._specularShader(ray);	
			}
			

			var computedColor = {
				r: ambientColor.r*ambientFactor + diffuseColor.r*diffuseFactor + specularColor.r*specularFactor,
				g: ambientColor.g*ambientFactor + diffuseColor.g*diffuseFactor + specularColor.g*specularFactor,
				b: ambientColor.b*ambientFactor + diffuseColor.b*diffuseFactor + specularColor.b*specularFactor,
				a: object.opacity*255,
			}

			// console.log("intersect at ", i, j);
			return{
				r: Math.min(computedColor.r, 255),
				g: Math.min(computedColor.g, 255),
				b: Math.min(computedColor.b, 255),
				a: Math.min(computedColor.a, 255),
			};
		}

		return {
			r: this.backgroundColor.r,
			g: this.backgroundColor.g,
			b: this.backgroundColor.b,
			a: this.backgroundColor.a,
		};
	}

	_diffuseShader(ray){
		var object        = ray.lowestIntersectObject;
		var intersect     = ray.lowestIntersectPoint;
		var n             = object.getNormalAt(intersect);
		var falloffFactor = this.falloffFactor;

		var intensities      = [];
		var unShadowedLights = 0;
		var totalIntensity   = 0;

		if(this.getLightList())
			this.getLightList().map((light, index, lights)=>{
				var s = Math3D.vectorizePoints(intersect, light.source);
				var v = Math3D.vectorizePoints(intersect, ray.e);
				var ns    = Math3D.dotProduct(n, s);

				//Compute Falloff from Lightsource
				var distance = Math3D.magnitudeOfVector(s);

				if(distance > -1 && distance < 1)
					distance = 1;

				//Compute Diffuse Intensity
				var nDots = ns/(Math3D.magnitudeOfVector(s)*Math3D.magnitudeOfVector(n));
				var diffuseIntensity = (light.intensity*Math.max(nDots, 0))/((distance/falloffFactor)^2);

				totalIntensity += diffuseIntensity;
			});

		return {
			r:object.diffuseC.r*totalIntensity,
			g:object.diffuseC.g*totalIntensity,
			b:object.diffuseC.b*totalIntensity,
			a:255}
	}

	_specularShader(ray){
		var object        = ray.lowestIntersectObject;
		var intersect     = ray.lowestIntersectPoint;
		var n             = object.getNormalAt(intersect);
		var falloffFactor = this.falloffFactor;

		var intensities      = [];
		var unShadowedLights = 0;
		var totalIntensity   = 0;

		if(this.getLightList())
			this.getLightList().map((light, index, lights)=>{
				var s = Math3D.vectorizePoints(intersect, light.source);
				var v = Math3D.vectorizePoints(intersect, ray.e);
				var ns    = Math3D.dotProduct(n, s);

				var magN  = Math3D.magnitudeOfVector(n);
				var coeff = 2*((ns/(magN*magN)));
				
				var r = Math3D.addVectors(
						Math3D.scalarMultiply(s, -1.0),
						Math3D.scalarMultiply(n, coeff)
					);

				var f = object.specularFalloff;

				//Compute Falloff from Lightsource
				var distance = Math3D.magnitudeOfVector(s);

				if(distance > -1 && distance < 1)
					distance = 1;

				//Compute Specular Intensity
				var specularIntensity = 0;
				var vDotr = Math3D.dotProduct(v, r)/(Math3D.magnitudeOfVector(v)*Math3D.magnitudeOfVector(r));
				if(vDotr > 0)
					specularIntensity = (light.intensity*Math.max(Math.pow(vDotr,f), 0))/((distance/falloffFactor/50)^2);

				totalIntensity += specularIntensity;
			});

		return {
			r:object.specularC.r*totalIntensity,
			g:object.specularC.g*totalIntensity,
			b:object.specularC.b*totalIntensity,
			a:255}
	}
}