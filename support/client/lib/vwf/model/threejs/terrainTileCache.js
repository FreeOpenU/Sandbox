"use strict";

function geometryToBufferGeometryKeepIndex(geometry, settings) {

    if (geometry instanceof THREE.BufferGeometry) {

        return geometry;

    }

    settings = settings || {
        'vertexColors': THREE.NoColors
    };

    var vertices = geometry.vertices;
    var faces = geometry.faces;
    var faceVertexUvs = geometry.faceVertexUvs;
    var vertexColors = settings.vertexColors;
    var hasFaceVertexUv = faceVertexUvs[0].length > 0;
    var hasFaceVertexNormals = faces[0].vertexNormals.length == 3;

    var bufferGeometry = new THREE.BufferGeometry();
    bufferGeometry.topEdgeMap = [];
    for (var i = 0; i < vertices.length; i++) {
        bufferGeometry.topEdgeMap[i] = vertices[i].topedge;
    }
    bufferGeometry.attributes = {

        position: {
            itemSize: 3,
            array: new Float32Array(vertices.length * 3)
        },
        normal: {
            itemSize: 3,
            array: new Float32Array(vertices.length * 3)
        },
        index: {
            itemSize: 3,
            array: new Int16Array(faces.length * 3)
        }

    }

    var positions = bufferGeometry.attributes.position.array;
    var normals = bufferGeometry.attributes.normal.array;
    var index = bufferGeometry.attributes.index.array;
    if (vertexColors !== THREE.NoColors) {

        bufferGeometry.attributes.color = {
            itemSize: 3,
            array: new Float32Array(faces.length * 3 * 3)
        };

        var colors = bufferGeometry.attributes.color.array;

    }

    if (hasFaceVertexUv === true) {

        bufferGeometry.attributes.uv = {
            itemSize: 2,
            array: new Float32Array(faces.length * 3 * 2)
        };

        var uvs = bufferGeometry.attributes.uv.array;

    }

    var i2 = 0,
        i3 = 0;
    for (var i = 0; i < vertices.length; i++) {
        positions[i * 3 + 0] = vertices[i].x;
        positions[i * 3 + 1] = vertices[i].y;
        positions[i * 3 + 2] = vertices[i].z;

        normals[i * 3 + 0] = vertices[i].x;
        normals[i * 3 + 1] = vertices[i].y;
        normals[i * 3 + 2] = vertices[i].z;


    }
    for (var i = 0; i < faces.length; i++) {

        var face = faces[i];

        var a = vertices[face.a];
        var b = vertices[face.b];
        var c = vertices[face.c];


        index[i * 3] = face.a;
        index[i * 3 + 1] = face.b;
        index[i * 3 + 2] = face.c;


        if (vertexColors === THREE.FaceColors) {

            var fc = face.color;

            colors[i3] = fc.r;
            colors[i3 + 1] = fc.g;
            colors[i3 + 2] = fc.b;

            colors[i3 + 3] = fc.r;
            colors[i3 + 4] = fc.g;
            colors[i3 + 5] = fc.b;

            colors[i3 + 6] = fc.r;
            colors[i3 + 7] = fc.g;
            colors[i3 + 8] = fc.b;

        } else if (vertexColors === THREE.VertexColors) {

            var vca = face.vertexColors[0];
            var vcb = face.vertexColors[1];
            var vcc = face.vertexColors[2];

            colors[i3] = vca.r;
            colors[i3 + 1] = vca.g;
            colors[i3 + 2] = vca.b;

            colors[i3 + 3] = vcb.r;
            colors[i3 + 4] = vcb.g;
            colors[i3 + 5] = vcb.b;

            colors[i3 + 6] = vcc.r;
            colors[i3 + 7] = vcc.g;
            colors[i3 + 8] = vcc.b;

        }

        if (hasFaceVertexUv === true) {

            var uva = faceVertexUvs[0][i][0];
            var uvb = faceVertexUvs[0][i][1];
            var uvc = faceVertexUvs[0][i][2];

            uvs[i2] = uva.x;
            uvs[i2 + 1] = uva.y;

            uvs[i2 + 2] = uvb.x;
            uvs[i2 + 3] = uvb.y;

            uvs[i2 + 4] = uvc.x;
            uvs[i2 + 5] = uvc.y;

        }

        i3 += 9;
        i2 += 6;

    }

    bufferGeometry.computeBoundingSphere();

    return bufferGeometry;

}

function TileCache() {
    this.tiles = {};


    //default material expects all computation done cpu side, just renders
    // note that since the color, size, spin and orientation are just linear
    // interpolations, they can be done in the shader
    var vertShader_default =


        "varying vec3 vFogPosition;" +
        "varying vec3 opos;" +
        "varying vec3 npos;" +
        "varying vec3 n;" +
        "varying vec3 wN;" +
        "varying vec3 coordsScaleB;" +
        "varying vec3 coordsScaleA;" +
        "uniform float blendPercent;\n" +
        "uniform float coordA;\n" +
        "uniform float coordB;\n" +


        "varying vec4 mvPosition;\n" +
        "varying vec3 debug;\n" +
        "uniform vec3 debugColor;\n" +
        "uniform float side;\n" +
        "attribute vec3 everyOtherNormal;\n" +
        "attribute vec3 ONormal;\n" +
        "attribute float everyOtherZ;\n" +

        "void main() {\n" +
        " float z = mix(everyOtherZ,position.z,blendPercent);\n" +
        " vFogPosition = (modelMatrix * vec4(position.xy,z,1.0)).xyz; \n" +
        "opos = vec3(position.xy,z);\n" +
        "npos = vFogPosition;\n" +
        //"npos.z += getNoise(vFogPosition.xy*200.0)/50.0; \n"+
        "coordsScaleB = npos/coordB;\n" +
        "coordsScaleA = npos/coordA;\n" +
        "float  edgeblend = 0.0;" +

        "debug = vec3(0.0,0.0,0.0);\n" +
        " if(side == 1.0 && position.y > 49.0) {edgeblend = 1.0; debug = vec3(1.0,1.0,1.0);}\n" +
        " if(side == 2.0 && position.y < -49.0) {edgeblend = 1.0; debug = vec3(1.0,1.0,1.0);}\n" +
        " if(side == 3.0 && position.x < -49.0) {edgeblend = 1.0; debug = vec3(1.0,1.0,1.0);}\n" +
        " if(side == 4.0 && position.x > 49.0) {edgeblend = 1.0; debug = vec3(1.0,1.0,1.0);}\n" +
        " if(side == 5.0 && (position.y > 49.0 || position.x > 49.0)) {edgeblend = 1.0; debug = vec3(1.0,1.0,1.0);}\n" +
        " if(side == 5.0 && (position.y > 49.0 || position.x > 49.0)) {edgeblend = 1.0; debug = vec3(1.0,1.0,1.0);}\n" +
        " if(side == 6.0 && (position.y < -49.0 || position.x > 49.0)) {edgeblend = 1.0; debug = vec3(1.0,1.0,1.0);}\n" +
        " if(side == 7.0 && (position.y > 49.0 || position.x < -49.0)) {edgeblend = 1.0; debug = vec3(1.0,1.0,1.0);}\n" +
        " if(side == 8.0 && (position.y < -49.0 || position.x < -49.0)) {edgeblend = 1.0; debug = vec3(1.0,1.0,1.0);}\n" +

        
        "wN = mix(everyOtherNormal,ONormal,blendPercent);\n" +
        "if(edgeblend == 1.0) {z=everyOtherZ;wN = everyOtherNormal; }\n" +

        "n = normalMatrix *  wN\n;" +

        "n = normalize(n);\n" +
        "  mvPosition = modelViewMatrix * vec4( position.x,position.y,z, 1.0 );\n" +

        "debug = wN;\n" +
        "   gl_Position = projectionMatrix * mvPosition;\n" +
        "}    \n";
    var fragShader_default_start =


        "#extension GL_OES_standard_derivatives : enable\n" +
        "#if MAX_DIR_LIGHTS > 0\n" +


        //"#define USE_FOG" : "",
        //"#define FOG_EXP2" : "",

        "uniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];\n" +
        "uniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];\n" +


        "uniform vec3 fogColor;" +
        "uniform int fogType;" +
        "uniform int renderMode;" +

        "uniform float fogDensity;" +
        "uniform float fogNear;" +
        "uniform float fogFar;" +
        "uniform float vFalloff;" +
        "uniform float vFalloffStart;" +
        "uniform vec3 vAtmosphereColor;\n" + //vec3(0.0, 0.02, 0.04);
        "uniform vec3 vHorizonColor;\n" + //vec3(0.88, 0.94, 0.999);
        "uniform vec3 vApexColor;\n" + //vec3(0.78, 0.82, 0.999)
        "uniform float vAtmosphereDensity;\n" + //.0005


        "uniform float coordA;\n" +
        "uniform float coordB;\n" +

        //"horizonColor = fogColor;\n"+
        //"zenithColor = vec3(0.78, 0.82, 0.999);\n"+
        //"gl_FragColor.xyz = aerialPerspective(gl_FragColor.xyz, distance(pos,cameraPosition),cameraPosition.xzy, normalize(pos-cameraPosition).xzy);\n"+
        "vec3 horizonColor = vHorizonColor;\n" +
        "vec3 zenithColor = vApexColor;\n" +

        "vec3 atmosphereColor(vec3 rayDirection){\n" +
        "    float a = max(0.0, dot(rayDirection, vec3(0.0, 1.0, 0.0)));\n" +
        "    vec3 skyColor = mix(horizonColor, zenithColor, a);\n" +
        "    float sunTheta = max( dot(rayDirection, directionalLightDirection[0].xzy), 0.0 );\n" +
        "    return skyColor+directionalLightColor[0]*4.0*pow(sunTheta, 16.0)*0.5;\n" +
        "}\n" +

        "vec3 applyFog(vec3 albedo, float dist, vec3 rayOrigin, vec3 rayDirection){\n" +
        "    float fogDensityA = fogDensity ;\n" +
        "    float fog = exp((-rayOrigin.y*vFalloff)*fogDensityA) * (1.0-exp(-dist*rayDirection.y*vFalloff*fogDensityA))/(rayDirection.y*vFalloff);\n" +
        "    return mix(albedo, fogColor, clamp(fog, 0.0, 1.0));\n" +
        "}\n" +

        "vec3 aerialPerspective(vec3 albedo, float dist, vec3 rayOrigin, vec3 rayDirection){\n" +
        " rayOrigin.y += vFalloffStart;\n" +
        "    vec3 atmosphere = atmosphereColor(rayDirection)+vAtmosphereColor; \n" +
        "    atmosphere = mix( atmosphere, atmosphere*.75, clamp(1.0-exp(-dist*vAtmosphereDensity), 0.0, 1.0));\n" +
        "    vec3 color = mix( applyFog(albedo, dist, rayOrigin, rayDirection), atmosphere, clamp(1.0-exp(-dist*vAtmosphereDensity), 0.0, 1.0));\n" +
        "    return color;\n" +
        "}						\n" +


        "#endif\n" +


        (["const float C1 = 0.429043;",
            "const float C2 = 0.511664;",
            "const float C3 = 0.743125;",
            "const float C4 = 0.886227;",
            "const float C5 = 0.247708;",

            // Constants for Old Town Square lighting
            "const vec3 L00  = vec3( 0.871297,  0.875222,  0.864470);",
            "const vec3 L1m1 = vec3( 0.175058,  0.245335,  0.312891);",
            "const vec3 L10  = vec3( 0.034675,  0.036107,  0.037362);",
            "const vec3 L11  = vec3(-0.004629, -0.029448, -0.048028);",
            "const vec3 L2m2 = vec3(-0.120535, -0.121160, -0.117507);",
            "const vec3 L2m1 = vec3( 0.003242,  0.003624,  0.007511);",
            "const vec3 L20  = vec3(-0.028667, -0.024926, -0.020998);",
            "const vec3 L21  = vec3(-0.077539, -0.086325, -0.091591);",
            "const vec3 L22  = vec3(-0.161784, -0.191783, -0.219152);"
        ].join('\n')) +

        "varying vec4 mvPosition;\n" +
        "varying vec3 debug;\n" +
        "varying vec3 vFogPosition;" +
        "varying vec3 n;" +
        "varying vec3 wN;" +
        "varying vec3 npos;" +
        "varying vec3 opos;" +
        "uniform vec3 ambientLightColor;" +
        "varying vec3 coordsScaleB;" +
        "varying vec3 coordsScaleA;";

    var fragShader_default_end =

        "vec4 packFloatVec4(const in float depth)\n" +
        "{\n" +
        "   const vec4 bit_shift = vec4(256.0*256.0*256.0, 256.0*256.0, 256.0, 1.0);\n" +
        "   const vec4 bit_mask  = vec4(0.0, 1.0/256.0, 1.0/256.0, 1.0/256.0);\n" +
        "   vec4 res = fract(depth * bit_shift);\n" +
        "   res -= res.xxyz * bit_mask;\n" +
        "   return res;\n" +
        "}\n" +

        "void main() {\n" +


        " if(renderMode == 1){ gl_FragColor = packFloatVec4(vFogPosition.z/1000.0); return; }\n" +
        "   vec3 vLightDir = normalize(viewMatrix * vec4(directionalLightDirection[0],0.0)).xyz;\n" +
        "	vec3 nn = (viewMatrix * normalize(vec4(wN,0.0))).xyz;\n" +
        " if(renderMode == 2){" +

        " gl_FragColor = getGrassDensity(npos,normalize(wN),opos.xy/100.0 + 0.5);\n" +
        " gl_FragColor.a = (clamp(dot(nn, vLightDir),0.0,1.0));\n" +
        "return;" +
        " }\n" +
        "	vec4 diffuse = getTexture(npos,normalize(wN),opos.xy/100.0 + 0.5);\n" +
        "	diffuse.a = 1.0;\n" +

        "   nn = getNormal(npos,nn,opos.xy/100.0 + 0.5,wN);\n" +
        "	vec3 light = vec3(0.0,0.0,0.0);\n" +
        "vec3 tnorm = ( vec4(nn,0.0) * viewMatrix).xyz;\n" +
        "vec3 shAmbient =  C1 * L22 * (tnorm.x * tnorm.x - tnorm.y * tnorm.y) +" +
        "            C3 * L20 * tnorm.z * tnorm.z +" +
        "            C4 * L00 -" +
        "            C5 * L20 +" +
        "           2.0 * C1 * L2m2 * tnorm.x * tnorm.y +" +
        "           2.0 * C1 * L21  * tnorm.x * tnorm.z +" +
        "           2.0 * C1 * L2m1 * tnorm.y * tnorm.z +" +
        "          2.0 * C2 * L11  * tnorm.x +" +
        "          2.0 * C2 * L1m1 * tnorm.y + " +
        "          2.0 * C2 * L10  * tnorm.z;" +

        "	vec4 ambient = vec4(shAmbient * length(ambientLightColor) * .5 ,1.0);\n" +


        "	#if MAX_DIR_LIGHTS > 0\n" +

        "   vec3 vEyeDir = normalize((viewMatrix * vec4(normalize(vFogPosition-cameraPosition ),0.0)).xyz);\n" +
        "   vec3 vReflectDir = normalize(reflect(vLightDir,nn));\n" +
        //"   float phong =pow( min(1.0,max(0.0,dot(vReflectDir,vEyeDir) + .3)),1.0 );\n"+
        "	light += directionalLightColor[0] * clamp(dot(nn, vLightDir),0.0,1.0);\n" +
        "	#endif\n" +


        "   gl_FragColor = ambient * diffuse + diffuse * vec4(light.xyz,1.0);\n" +
        "gl_FragColor.a = 1.0;\n" +
        "#ifdef USE_FOG\n" +


        //"gl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor );\n"+

        //"gl_FragColor.xyz = nn;\n"+
        "gl_FragColor.xyz = aerialPerspective(gl_FragColor.xyz, distance(vFogPosition,cameraPosition),cameraPosition.xzy, normalize(vFogPosition-cameraPosition).xzy);\n" +
        "#endif\n" +
        //"gl_FragColor = vec4(nn.rgb,1.0);\n"+
        "}\n";

    //the default shader - the one used by the analytic solver, just has some simple stuff
    //note that this could be changed to do just life and lifespan, and calculate the 
    //size and color from to uniforms. Im not going to bother


    //uniforms_default.texture.value.wrapS = uniforms_default.texture.value.wrapT = THREE.RepeatWrapping;

    this.getDefaultDiffuseString = function() {
        return "vec4 getTexture(vec3 coords, vec3 norm, vec2 uv) {return vec4(1.0,1.0,1.0,1.0);}\n";

    }
    this.getDefaultNormalString = function() {
        return "vec3 getNormal(vec3 coords, vec3 viewNorm, vec2 uv,vec3 wN) {return viewNorm;}\n";
    }
    this.getMat = function() {


        var algorithmShaderStringDiffuse = this.terrainGenerator.getDiffuseFragmentShader ? this.terrainGenerator.getDiffuseFragmentShader() : '';
        var algorithmShaderStringNormal = this.terrainGenerator.getNormalFragmentShader ? this.terrainGenerator.getNormalFragmentShader() : '';
        var algorithmUniforms = this.terrainGenerator.getMaterialUniforms();

        var uniforms_default = THREE.UniformsUtils.merge([
            THREE.UniformsLib["fog"], {


                ambientLightColor: {
                    type: "fv",
                    value: []
                },

                directionalLightColor: {
                    type: "fv",
                    value: []
                },
                directionalLightDirection: {
                    type: "fv",
                    value: []
                },

                pointLightColor: {
                    type: "fv",
                    value: []
                },
                pointLightPosition: {
                    type: "fv",
                    value: []
                },
                pointLightDistance: {
                    type: "fv1",
                    value: []
                },

                spotLightColor: {
                    type: "fv",
                    value: []
                },
                spotLightPosition: {
                    type: "fv",
                    value: []
                },
                spotLightDistance: {
                    type: "fv",
                    value: []
                },
                spotLightDirection: {
                    type: "fv1",
                    value: []
                },
                spotLightAngleCos: {
                    type: "fv1",
                    value: []
                },
                spotLightExponent: {
                    type: "fv1",
                    value: []
                },

                hemisphereLightSkyColor: {
                    type: "fv",
                    value: []
                },
                hemisphereLightGroundColor: {
                    type: "fv",
                    value: []
                },
                hemisphereLightDirection: {
                    type: "fv",
                    value: []
                },

                noiseSampler: {
                    type: "t",
                    value: _SceneManager.getTexture("terrain/bestnoise.png")
                },
                "side": {
                    type: "f",
                    value: 0
                },

                "blendPercent": {
                    type: "f",
                    value: 0.00000
                },
                "coordA": {
                    type: "f",
                    value: 100
                },
                "coordB": {
                    type: "f",
                    value: 10
                },
                "renderMode": {
                    type: "i",
                    value: 0
                },
                debugColor: {
                    type: "c",
                    value: new THREE.Color(0xffff0f)
                },

            }
        ]);
        for (var i in algorithmUniforms)
            uniforms_default[i] = algorithmUniforms[i];
        var attributes_default = {
            everyOtherNormal: {
                type: 'v3',
                value: []
            },
            everyOtherZ: {
                type: 'f',
                value: []
            },

            ONormal: {
                type: 'v3',
                value: []
            },
        };
        var mat = new THREE.ShaderMaterial({
            uniforms: uniforms_default,
            attributes: attributes_default,
            vertexShader: vertShader_default,
            fragmentShader: (fragShader_default_start + (algorithmShaderStringDiffuse || this.getDefaultDiffuseString()) + (algorithmShaderStringNormal || this.getDefaultNormalString()) + fragShader_default_end)

        });
        mat.lights = true;
        mat.fog = true;


        uniforms_default.noiseSampler.value.wrapS = uniforms_default.noiseSampler.value.wrapT = THREE.RepeatWrapping;
        //mat.wireframe = true;

        this.mat = mat;
        return mat;

        // this.mat = new THREE.MeshPhongMaterial();
        // this.mat.color.r = .5;
        // this.mat.color.g = .5;
        // this.mat.color.b = .5;
        // this.mat.depthCheck = false;
        // this.mat.wireframe = false;
        // this.mat.transparent = true;	
    }


    this.buildMesh0 = function(size, res) {

        var geo = new THREE.Geometry();
        var step = size / (res);
        var count = 0;
        for (var i = 0; i <= size + step + step; i += step) {

            for (var j = 0; j <= size + step + step; j += step) {
                var z = 0;
                var x = i - size / 2;
                var y = j - size / 2;
                var v = new THREE.Vector3(x, y, z);
                geo.vertices.push(v);
            }
            count++;
        }

        for (var i = 0; i < count - 3; i++) {
            for (var j = 0; j < count - 3; j++) {

                var x = i;
                var y = j;

                var f = new THREE.Face3(x * (count) + y, (x + 1) * count + y, (x + 1) * count + y + 1); //,x*count+y+1)
                f.vertexNormals.push(new THREE.Vector3(0, 0, 1));
                f.vertexNormals.push(new THREE.Vector3(1, 0, 0));
                f.vertexNormals.push(new THREE.Vector3(0, 0, 1));

                f.normal = new THREE.Vector3(0, 0, 1);
                geo.faces.push(f);

                var f = new THREE.Face3(x * (count) + y, (x + 1) * count + y + 1, (x) * count + y + 1); //,x*count+y+1)
                f.vertexNormals.push(new THREE.Vector3(0, 0, 1));
                f.vertexNormals.push(new THREE.Vector3(1, 0, 0));
                f.vertexNormals.push(new THREE.Vector3(0, 0, 1));

                f.normal = new THREE.Vector3(0, 0, 1);
                geo.faces.push(f);
                //f.vertexNormals.push(new THREE.Vector3(0,0,1));
            }
        }

        for (var i = 0; i < count - 3; i++) {
            for (var j = 0; j < count - 3; j++) {
                if (j == 0) {

                    var x = i;
                    var y = j;

                    var A = x * (count) + y;
                    var B = (x + 1) * count + y
                    var vertC = geo.vertices[B].clone();
                    vertC.topedge = B;
                    vertC.z = -10;
                    geo.vertices.push(vertC);
                    var C = geo.vertices.length - 1;
                    var f = new THREE.Face3(B, A, C); //,x*count+y+1)

                    f.vertexNormals.push(new THREE.Vector3(0, 0, 1));
                    f.vertexNormals.push(new THREE.Vector3(1, 0, 0));
                    f.vertexNormals.push(new THREE.Vector3(0, 0, 1));

                    f.normal = new THREE.Vector3(0, 0, 1);
                    geo.faces.push(f);


                    var vertD = geo.vertices[A].clone();
                    vertD.topedge = A;
                    vertD.z = -10;
                    geo.vertices.push(vertD);
                    var D = geo.vertices.length - 1;
                    var f = new THREE.Face3(C, A, D); //,x*count+y+1)

                    f.vertexNormals.push(new THREE.Vector3(0, 0, 1));
                    f.vertexNormals.push(new THREE.Vector3(1, 0, 0));
                    f.vertexNormals.push(new THREE.Vector3(0, 0, 1));

                    f.normal = new THREE.Vector3(0, 0, 1);
                    geo.faces.push(f);
                    //f.vertexNormals.push(new THREE.Vector3(0,0,1));
                }
                if (i == 0) {

                    var x = i;
                    var y = j;

                    var A = x * (count) + y;
                    var B = (x) * count + y + 1
                    var vertC = geo.vertices[B].clone();
                    vertC.topedge = B;
                    vertC.z = -10;
                    geo.vertices.push(vertC);
                    var C = geo.vertices.length - 1;
                    var f = new THREE.Face3(A, B, C); //,x*count+y+1)

                    f.vertexNormals.push(new THREE.Vector3(0, 0, 1));
                    f.vertexNormals.push(new THREE.Vector3(1, 0, 0));
                    f.vertexNormals.push(new THREE.Vector3(0, 0, 1));

                    f.normal = new THREE.Vector3(0, 0, 1);
                    geo.faces.push(f);

                    var vertD = geo.vertices[A].clone();
                    vertD.topedge = A;
                    vertD.z = -10;
                    geo.vertices.push(vertD);
                    var D = geo.vertices.length - 1;
                    var f = new THREE.Face3(C, D, A); //,x*count+y+1)

                    f.vertexNormals.push(new THREE.Vector3(0, 0, 1));
                    f.vertexNormals.push(new THREE.Vector3(1, 0, 0));
                    f.vertexNormals.push(new THREE.Vector3(0, 0, 1));

                    f.normal = new THREE.Vector3(0, 0, 1);
                    geo.faces.push(f);

                }

                if (i == count - 4) {

                    var x = i + 1;
                    var y = j;

                    var A = x * (count) + y;
                    var B = (x) * count + y + 1
                    var vertC = geo.vertices[B].clone();
                    vertC.z = -10;
                    vertC.topedge = B;
                    geo.vertices.push(vertC);
                    var C = geo.vertices.length - 1;
                    var f = new THREE.Face3(B, A, C); //,x*count+y+1)

                    f.vertexNormals.push(new THREE.Vector3(0, 0, 1));
                    f.vertexNormals.push(new THREE.Vector3(1, 0, 0));
                    f.vertexNormals.push(new THREE.Vector3(0, 0, 1));

                    f.normal = new THREE.Vector3(0, 0, 1);
                    geo.faces.push(f);

                    var vertD = geo.vertices[A].clone();
                    vertD.z = -10;
                    geo.vertices.push(vertD);
                    var D = geo.vertices.length - 1;
                    var f = new THREE.Face3(D, C, A); //,x*count+y+1)
                    vertD.topedge = A;
                    f.vertexNormals.push(new THREE.Vector3(0, 0, 1));
                    f.vertexNormals.push(new THREE.Vector3(1, 0, 0));
                    f.vertexNormals.push(new THREE.Vector3(0, 0, 1));

                    f.normal = new THREE.Vector3(0, 0, 1);
                    geo.faces.push(f);

                }

                if (j == count - 4) {

                    var x = i;
                    var y = j + 1;

                    var A = x * (count) + y;
                    var B = (x + 1) * count + y
                    var vertC = geo.vertices[B].clone();
                    vertC.topedge = B;
                    vertC.z = -10;
                    geo.vertices.push(vertC);
                    var C = geo.vertices.length - 1;
                    var f = new THREE.Face3(B, C, A); //,x*count+y+1)

                    f.vertexNormals.push(new THREE.Vector3(0, 0, 1));
                    f.vertexNormals.push(new THREE.Vector3(1, 0, 0));
                    f.vertexNormals.push(new THREE.Vector3(0, 0, 1));

                    f.normal = new THREE.Vector3(0, 0, 1);
                    geo.faces.push(f);


                    var vertD = geo.vertices[A].clone();
                    vertD.topedge = A;
                    vertD.z = -10;
                    geo.vertices.push(vertD);
                    var D = geo.vertices.length - 1;
                    var f = new THREE.Face3(C, D, A); //,x*count+y+1)

                    f.vertexNormals.push(new THREE.Vector3(0, 0, 1));
                    f.vertexNormals.push(new THREE.Vector3(1, 0, 0));
                    f.vertexNormals.push(new THREE.Vector3(0, 0, 1));

                    f.normal = new THREE.Vector3(0, 0, 1);
                    geo.faces.push(f);
                    //f.vertexNormals.push(new THREE.Vector3(0,0,1));
                }
            }
        }

        return geo;
    }
    this.returnMesh = function(mesh) {

        if (mesh.quadnode)
            mesh.quadnode = null;
        if (mesh.parent)
            mesh.parent.remove(mesh);
    }
    this.clear = function() {
        this.tiles = [];
    }
    this.rebuildAllMaterials = function() {
        for (var j in this.tiles) {
            if (this.tiles[j])
                for (var i = 0; i < this.tiles[j].length; i++) {
                    var mat = this.getMat();
                    mat.attributes = this.tiles[j][i].material.attributes;
                    this.tiles[j][i].material = mat;
                }
        }

    }
    this.getMesh = function(res, side) {
        if (this.tiles[res])
            for (var i = 0; i < this.tiles[res].length; i++)
                if (this.tiles[res][i].quadnode == null) {
                    return this.tiles[res][i];
                }
        if (!this.tiles[res])
            this.tiles[res] = [];


        var newtile;

        newtile = new THREE.Mesh(geometryToBufferGeometryKeepIndex(this.buildMesh0(100, res)), this.getMat());
        newtile.geometry.addAttribute('ONormal', new THREE.BufferAttribute(new Float32Array(newtile.geometry.attributes.position.array.length), 3));
        newtile.geometry.addAttribute('everyOtherNormal', new THREE.BufferAttribute(new Float32Array(newtile.geometry.attributes.position.array.length), 3));
        newtile.geometry.addAttribute('everyOtherZ', new THREE.BufferAttribute(new Float32Array(newtile.geometry.attributes.position.array.length / 3), 1));

        newtile.res = res + 3;
        newtile.geometry.dynamic = true;
        newtile.doublesided = false;
        newtile.side = side;
        newtile.receiveShadow = true;
        newtile.castShadow = false;
        newtile.material.uniforms.side.value = side;
        newtile.matrixAutoUpdate = false;

        newtile.geometry.attributes.everyOtherZ.needsUpdate = true;
        newtile.geometry.attributes.everyOtherNormal.needsUpdate = true;
        //so, it appears that it might just be better to generate a new one than store it 
        //memory / cpu tradeoff
        this.tiles[res].push(newtile);
        return newtile;
    }
}

//@ sourceURL=threejs.terrain.TileCache