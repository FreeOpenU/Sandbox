//////////////////////////////
//The datamanager class fetches and posts data to the 
//sandbox API.
window.PersistanceServer = '';
define(function ()
{
	var DataManager = {};
	var isInitialized = false;
	return {
		getSingleton: function ()
		{
			if (!isInitialized)
			{
				initialize.call(DataManager);
				isInitialized = true;
			}
			return DataManager;
		}
	}

	function initialize()
	{
		
		this.rawdata = {
			profiles: {},
		};

		this.loadedScene = null;
		this.CleanInstanceName = function (name)
		{
			while (name.length < 16) name = name + '0';
			if (name.length > 16);
			name = name.substr(0, 16);
			name = name.replace(/[^0-9a-zA-Z]/g, '0');
			return name;
		}
		this.DeleteIDs = function (t,keepname)
		{
			if (t.id != undefined) delete t.id;
		

			if(!keepname)
				if (t.name != undefined) delete t.name;
			if (t.children)
			{
				var children = []
				for (var i in t.children)
				{
					this.DeleteIDs(t.children[i],keepname);
					children.push(t.children[i]);
					delete t.children[i];
				}
				for (var i = 0; i < children.length; i++)
				{
					t.children[children[i].name || GUID()] = children[i];
				}
			}
			return t;
		}
		this.GetUsers = function ()
		{
			var data = jQuery.ajax(
			{
				type: 'GET',
				url: PersistanceServer + '/vwfDataManager.svc/Profiles',
				data: null,
				success: null,
				async: false,
				dataType: "json"
			});
			data = JSON.parse(JSON.parse(data.responseText).GetProfilesResult);
			return data;
		}
		this.getCurrentUserName = function()
		{
				var data = jQuery.ajax(
				{
					type: 'GET',
					url: PersistanceServer + '/vwfDataManager.svc/logindata',
					//url: PersistanceServer + '/vwfDataManager.svc/Profile?UID=' + username + "&P=" + password,
					data: null,
					success: null,
					async: false,
					dataType: "json"
				});
				return JSON.parse(data.responseText).username;
		}
		this.GetProfileForUser = function (username, reload)
		{
			var profile = null;
			for (var i in this.rawdata.profiles)
			{
				if (this.rawdata.profiles[i].Username == username) profile = this.rawdata.profiles[i];
			}
			if (!profile || reload)
			{
				var UID = this.getCurrentSession();
				var data = jQuery.ajax(
				{
					type: 'GET',
					url: PersistanceServer + '/vwfDataManager.svc/Profile?UID='+username,
					data: null,
					success: null,
					async: false,
					dataType: "json"
				});
				if (data.status == 200)
				{
					try
					{
						data = JSON.parse(data.responseText);
						profile = data;
						this.rawdata.profiles[username] = profile;
					}
					catch (e)
					{
						return null;
					}
				}
				else
				{
					return null;
				}
			}
			return profile;
		}
		this.fixExtendsAndArrays = function (object)
		{
			if (object.extends && object.extends.patches) object.extends = object.extends.patches;
			for (var i in object.properties)
			{
				if (object.properties[i] && object.properties[i].constructor == Float32Array)
				{
					var newval = [];
					for (var j = 0; j < object.properties[i].length; j++) newval.push(object.properties[i][j]);
					object.properties[i] = newval;
				}
				if (i == 'quaternion')
				{
					object.properties[i] = [object.properties[i][0], object.properties[i][1], object.properties[i][2], object.properties[i][3]];
				}
			}
			if (object.children)
			{
				for (var i in object.children)
				{
					object.children[i] = this.fixExtendsAndArrays(object.children[i]);
				}
			}
			return object;
		}
		this.callGetters = function(node)
		{
			if (node.properties)
			{
				for (var i in node.properties)
				{
					node.properties[i] = vwf.getProperty(node.id, i);
				}
			}
			if (node.children)
			{
				for (var i in node.children)
				{
					this.callGetters(node.children[i])
				}
			}
		}
		this.GetNode = function (id)
		{
			var node = _Editor.getNode(id);
			this.callGetters(node);
			return node;
		}
		this.compareNode = function (node1, node2)
		{}
		
		this.getCleanNodePrototype = function (id)
		{
			if (typeof id === "string") return this.DeleteIDs(this.fixExtendsAndArrays(this.GetNode(id)));
			else return this.DeleteIDs(this.fixExtendsAndArrays(JSON.parse(JSON.stringify(id))));
		}
		this.getSaveNodePrototype = function (id)
		{
			if (typeof id === "string") return this.DeleteIDs(this.fixExtendsAndArrays(this.GetNode(id)),true);
			else return this.DeleteIDs(this.fixExtendsAndArrays(JSON.parse(JSON.stringify(id))),true);
		}
		this.getSaveStateData = function()
		{
			var scene = _Editor.getNode(vwf.application());
			var nodes = [];
			for (var i in scene.children)
			{
				var node = this.getSaveNodePrototype(scene.children[i].id);
				if (node.extends != "character.vwf" && node.extends != 'http://vwf.example.com/camera.vwf') nodes.push(node);
				
			}
			
			//note: we only save the scene properteis, so that users cannot overwrite parts of the 
			//application that  control the enviornment or camera
			var sceneprops = vwf.getProperties('index-vwf');
			//also just a design choice here, so that wehn we update the scene properties, old states will show the updates
			delete sceneprops.EditorData;
			delete sceneprops.playBackup;
			delete sceneprops.clients;
			nodes.push(sceneprops);
			return nodes;
			

		}
		this.saveToServer = function (sync)
		{

			if(!sync) sync = false;
			if (!_UserManager.GetCurrentUserName())
			{
				//console.log('no user logged in, so not saving');
				return;
			}
			
			//published states are never saved. 
			if(_DataManager.instanceData.publishSettings.persistence === false)
			{
				console.log('State settings prevent persistence, cannot save');
				return;
			}
			
			

			//if the editor is playing the scene, save the backup from before play was hit
			if(vwf.getProperty(vwf.application(),'playMode') == 'play')
			{
				console.log('Skipping save because scene is playing.');
				return;
			}
			
			
			var data = JSON.stringify(this.getSaveStateData());
			vwf.saveState(data);
			$('#SceneSaved').text(new Date());
		}
		this.getInstances = function ()
		{
			var data = jQuery.ajax(
			{
				type: 'GET',
				url: PersistanceServer + '/vwfDataManager.svc/States',
				data: null,
				success: null,
				async: false,
				dataType: "json"
			});
			data = JSON.parse(JSON.parse(data.responseText).GetStatesResult);
			//filter out the app name part of the state
			for (var i = 0; i < data.length; i++)
			{
				var parts = data[i].split('_');
				data[i] = parts[parts.length - 2];
			}
			return data;
		}
		//get the Id of the current world from the url
		this.getCurrentSession = function ()
		{
            var regExp = new RegExp(window.appPath+".*\/");
			return regExp.exec(window.location.pathname.toString()).toString();
		}
		//at this point, this server pretty much only supports the sandbox. This will return the sandbox root url
		this.getCurrentApplication = function ()
		{
			return location.protocol +'//'+  location.host + window.appPath;
		}
		//Get the number of users in this space. NOTE: Counts anonymous
		this.getClientCount = function ()
		{
			var instances = jQuery.ajax(
			{
				type: 'GET',
				url: "/admin/instances",
				data: null,
				success: null,
				async: false,
				dataType: "json"
			});
			instances = JSON.parse(instances.responseText);
			var clients = null;
			for (var i in instances)
			{
				if (i == _DataManager.getCurrentSession())
				{
					clients = instances[i].clients;
				}
			}
			var count = 0;
			for (var i in clients) count++;
			return count;
		}
		//Get the metadata for the current world, like title, lastupdate, publishsettings....
		this.getInstanceData = function()
		{
			if(this.instanceData) return this.instanceData;
			var instanceData = jQuery.ajax(
			{
				type: 'GET',
				url: "/vwfDataManager.svc/statedata?SID=" + this.getCurrentSession(),
				data: null,
				success: null,
				async: false,
				dataType: "json"
			});
			this.instanceData = JSON.parse(instanceData.responseText);
			return this.instanceData;
		}
		this.saveTimer = function ()
		{
			var num = this.getClientCount() + 1;
			var milliseconds = num * 1000 * 60;
			this.saveToServer();
			window.setTimeout(this.saveTimer.bind(this), milliseconds);
		}
		this.saveData = function ()
		{
			localStorage[this.datahandle] = JSON.stringify(this.rawdata);
		}
		PersistanceServer = this.getCurrentSession();
	}
});