if (typeof(Cc) == 'undefined')
	var Cc = Components.classes;
if (typeof(Ci) == 'undefined')
	var Ci = Components.interfaces;
if (typeof(Cr) == 'undefined')
	var Cr = Components.results;

if (typeof(SBProperties) == "undefined") {
	Cu.import("resource://app/jsmodules/sbProperties.jsm");
	if (!SBProperties)
		throw new Error("Import of sbProperties module failed");
}

if (typeof(LibraryUtils) == "undefined") {
	Cu.import("resource://app/jsmodules/sbLibraryUtils.jsm");
	if (!LibraryUtils)
		throw new Error("Import of sbLibraryUtils module failed");
}

if (typeof(SmartMediaListColumnSpecUpdater) == "undefined") {
	Cu.import("resource://app/jsmodules/sbSmartMediaListColumnSpecUpdater.jsm");
	if (!SmartMediaListColumnSpecUpdater)
		throw new Error("Import of sbSmartMediaList module failed");
}

var gMediaCore;

if (typeof(gBrowser) == "undefined")
	var gBrowser = Cc["@mozilla.org/appshell/window-mediator;1"]
			.getService(Ci.nsIWindowMediator)
			.getMostRecentWindow("Songbird:Main").window.gBrowser;

if (typeof(gSkSvc) == "undefined") {
	var gSkSvc = Cc["@songbirdnest.com/newreleases;1"]
		.getService(Ci.nsIClassInfo).wrappedJSObject;
}

if (typeof(gMetrics) == "undefined")
	var gMetrics = Cc["@songbirdnest.com/Songbird/Metrics;1"]
			.createInstance(Ci.sbIMetrics);

function debugLog(funcName, str) {
	var debug = Application.prefs.getValue("extensions.newreleases.debug", false);
	if (debug) {
		dump("*** NewReleases/main.js::" + funcName + " // " + str + "\n");
	}
}

if (typeof NewReleases == 'undefined') {
  var NewReleases = {};
}

//FIX:
//- fix On Tour functionality
//- property stuff - simply disable?
//- songkick.ico

NewReleases = {
	// Reference to the On Tour status icon
	_onTourIcon : null,
	lastReleasesCount : 0,
	touringPlaylist : null,

	onLoad: function() {
		// Initialization code
		this._initialized = true;
		this._strings = document.getElementById("newReleases-strings");

		if (typeof(Ci.sbIMediacoreManager) != "undefined") {
			this.newMediaCore = true;
			gMediaCore = Cc["@songbirdnest.com/Songbird/Mediacore/Manager;1"]
				.getService(Ci.sbIMediacoreManager);
		} else {
			this.newMediaCore = false;
			gMediaCore = Cc['@songbirdnest.com/Songbird/PlaylistPlayback;1']
				.getService(Ci.sbIPlaylistPlayback);
		}

		// Instantiate the New Releases XPCOM service
		this.nrSvc = Cc["@songbirdnest.com/newreleases;1"]
			.getService(Ci.nsIClassInfo).wrappedJSObject;
	
		// Wait until the On Tour properties are registered
		this._blockAndFinishLoad();
	},

	_blockAndFinishLoad: function _blockAndFinishLoad() {
		//if (!Components.classes
				//["@songbirdnest.com/Songbird/Properties/PropertyManager;1"]
				//.getService(Ci.sbIPropertyManager)
				//.hasProperty(this.nrSvc.onTourUrlProperty))
		if (false)
		{
			debugLog("_blockAndFinishLoad", "Waiting for property init..");
			setTimeout(_blockAndFinishLoad, 100);
		} else {
			debugLog("_blockAndFinishLoad", "On Tour properties exist!");
			// Add the service pane node
			this._setupServicePaneNode();

			// Register the releases count updater with the service
			this.updateNewReleasesCount.wrappedJSObject = this.updateNewReleasesCount;
			this.nrSvc.registerSPSUpdater(this.updateNewReleasesCount);

			// Save our property strings
			this.onTourImgProperty = this.nrSvc.onTourImgProperty;
			this.onTourUrlProperty = this.nrSvc.onTourUrlProperty;

			// Add the artist dataremote listener
			// This is what handles the OnTour status icon in the faceplate
			this._setupArtistDataRemote();

			// Startup a thread to refresh releases data
			this.nrSvc.startRefreshThread();

			// Add the Artists on Tour playlist
			this._getOnTourPlaylist();
			this.rebuildOnTourPlaylist();

			// Add our mediacore listener to listen for Artists on Tour plays
			// works for both old & new API since gMediaCore is aliased to gPPS
			// and both gPPS & the new media core manager have the same
			// addListener interface
			gMediaCore.addListener(this._mmListener);
	 
			// Add the listener for playlist "On Tour" clicks
			if (typeof(gBrowser) != "undefined")
				gBrowser.addEventListener("PlaylistCellClick", function(e) {
					var prop = e.getData("property");
					var item = e.getData("item");
					if (prop == gSkSvc.onTourImgProperty) {
						if (item.getProperty(prop) != "") {
							var url =
								item.getProperty(gSkSvc.onTourUrlProperty);
							var city = Application.prefs
									.getValue("extensions.newreleases.city", 0);
							url += "?user_location=" + city;
							gMetrics.metricsInc("newReleases", "library.link", "");
							gBrowser.loadOneTab(url);
						}
					}
				}, false);

			// Register our uninstall handler
			this.uninstallObserver.register();
			if (this.touringPlaylist != null)
				this.uninstallObserver.list = this.touringPlaylist;
		}
	},
  
	onUnLoad: function() {
		NewReleases._initialized = false;
		var nrSvc = Cc["@songbirdnest.com/newreleases;1"]
			.getService(Ci.nsIClassInfo).wrappedJSObject;
		nrSvc.unregisterSPSUpdater();
		if (NewReleases._artistDataRemote)
			NewReleases._artistDataRemote.unbind();
		gMediaCore.removeListener(this._mmListener);
	},
  
	/***********************************************************************
	 * Setup the service pane entry point node
	 **********************************************************************/
	_setupServicePaneNode : function() {
    var SB_NS = 'http://songbirdnest.com/data/1.0#';
    var SP_NS = 'http://songbirdnest.com/rdf/servicepane#';

		var SPS = Cc['@songbirdnest.com/servicepane/service;1'].
				getService(Ci.sbIServicePaneService);
		SPS.init();
    var BMS = Cc['@songbirdnest.com/servicepane/bookmarks;1']
                 .getService(Ci.sbIBookmarks);
		
    var servicesNode = SPS.getNode("SB:Services") ||
                       this._findServicesNode(SPS.root, SB_NS);
    if (servicesNode == null) {
      // No services node found, create one
      servicesNode = SPS.addNode("SB:Services", SPS.root, true);
      servicesNode.properties = 'folder services';
      servicesNode.name = SBString("servicesource.services");
      servicesNode.setAttributeNS(SB_NS, "servicesFolder", 1);
      servicesNode.setAttributeNS(SP_NS, "Weight", 1);
      SPS.sortNode(servicesNode);
    }

    var newReleasesURL = "chrome://newreleases/content/browse.xul";
		var newReleasesNode = SPS.getNode("urn:newreleases") ||
                       SPS.getNodeForURL(newReleasesURL);
		if (newReleasesNode != null) {
      // We found one - make sure it's homed under the Services folder
      if (newReleasesNode.parentNode &&
          newReleasesNode.parentNode.name != SBString("servicesource.services")) {
        // remove it
        SPS.removeNode(newReleasesNode);
        newReleasesNode = null;
      }
    }

    if (newReleasesNode == null) {
      // No New Releases node found, create a new one
      newReleasesNode = SPS.addNode("urn:newreleases", servicesNode, false);
      newReleasesNode.url = "chrome://newreleases/content/browse.xul";
      newReleasesNode.name = this._strings.getString("servicePaneName");
      newReleasesNode.image = 'chrome://newreleases/skin/node-icon.png';
      newReleasesNode.tooltip =
        this._strings.getString("servicePaneInitialTooltip");
      newReleasesNode.properties = "newReleases";
    }

    // may need to reset the name post-localisation
    //this.updateNewReleasesCount();

    // Save
    SPS.save();

		// outside the loop in case we're going from disabled->enabled
		newReleasesNode.hidden = false;
    servicesNode.hidden = false;
    newReleasesNode.editable = false;
    servicesNode.editable = false;
	},

  // Find the Services node in the servicepane
  _findServicesNode : function (node, ns) {
    // Found the node, return it
    if (node.isContainer && (node.getAttributeNS(ns, "servicesFolder") == 1))
      return node;

    // Otherwise recursively walk this node's children
    if (node.isContainer) {
      var children = node.childNodes;
      while (children.hasMoreElements()) {
        var child = children.getNext().QueryInterface(Ci.sbIServicePaneNode);
        var result = this._findServicesNode(child, ns);
        if (result != null)
          return result;
      }
    }
    return null;
  },

	updateNewReleasesCount : function(num) {
		var newReleasesCount;
		var nrSvc = Cc["@songbirdnest.com/newreleases;1"]
			.getService(Ci.nsIClassInfo).wrappedJSObject;
		var filter = Application.prefs.getValue(
				"extensions.newreleases.filterLibraryArtists", true);
		if (typeof(num) == "undefined") {
			newReleasesCount = nrSvc.getNewReleasesCount(filter);
		} else
			newReleasesCount = num;

dump("lastReleasesCount: " + this.lastReleasesCount + ", newReleasesCount: " + newReleasesCount + "\n");
		// Only update if the count has changed
		if (this.lastReleasesCount == newReleasesCount)
			return;
		this.lastReleasesCount = newReleasesCount;

		var name;
		var tooltip;
		if (typeof(this.servicePaneStr) == "undefined") {
			this.servicePaneStr = Cc["@mozilla.org/intl/stringbundle;1"]
				.getService(Ci.nsIStringBundleService)
				.createBundle("chrome://newreleases/locale/overlay.properties");

		}

		var SPS = Components.classes['@songbirdnest.com/servicepane/service;1']
			.getService(Components.interfaces.sbIServicePaneService);
		SPS.init();
		var newReleasesNode = SPS.getNode("urn:newreleases");
		if (newReleasesNode != null) {
			if (newReleasesCount > 0) {
				newReleasesNode.name = 
					this.servicePaneStr.GetStringFromName("servicePaneName")
					+ " (" + newReleasesCount + ")";
			} else {
				newReleasesNode.name = 
					this.servicePaneStr.GetStringFromName("servicePaneName")
			}
			newReleasesNode.tooltip = newReleasesCount +
				this.servicePaneStr.GetStringFromName("servicePaneTooltip")
		}
		SPS.save();
	},
	

	/***********************************************************************
	 * Routines for handling displaying the "On Tour" status icon in the
	 * faceplate, and handling the user clicking on it.
	 **********************************************************************/
	// Setup the artist dataremote and the "On Tour" status icon itself
	_setupArtistDataRemote : function() {
		// If we're in the miniplayer, then don't attach
		if (typeof(gBrowser) == "undefined")
			return;

		// Add the "On Tour" status 
		var artistBox;
		// gonzo faceplate rulez
		artistBox = document.getElementById("faceplate-tool-bar");
		// XXX rubberducky faceplate droolz
		if (artistBox == null)
			artistBox = document.getElementById("sb-faceplate-artist-box");
		// XXX anything else is pure shite
		if (artistBox == null)
			return;

		this._onTourIcon = document.createElement('image');
		this._onTourIcon.setAttribute("id", "faceplate-artist-on-tour-icon");
		this._onTourIcon.setAttribute("src",
				"chrome://newreleases/skin/icon-ticket.png");
		this._onTourIcon.setAttribute("onmousedown",
				"NewReleases.loadArtist(event)");
		this._onTourIcon.setAttribute("mousethrough", "never");
		debugLog("setupArtistDataRemote", "Added click handler for faceplate");
		this._onTourIcon.style.visibility = "collapse";
		artistBox.appendChild(this._onTourIcon);

		// Add the dataremote listener itself
		var createDataRemote = new Components.Constructor(
				"@songbirdnest.com/Songbird/DataRemote;1",
				Ci.sbIDataRemote, "init");
		NewReleases._artistDataRemote = createDataRemote("metadata.artist", null);
		NewReleases._artistDataRemote.bindObserver(this, true);

		// See if we're already playing (to catch the feather/layout switch)
		var currentItem;
		var playing = false;
		if (this.newMediaCore && (
			gMediaCore.status.state == Ci.sbIMediacoreStatus.STATUS_PLAYING ||
			gMediaCore.status.state == Ci.sbIMediacoreStatus.STATUS_BUFFERING ||
			gMediaCore.status.state == Ci.sbIMediacoreStatus.STATUS_PAUSED))
		{
			playing = true;
			currentItem = gMediaCore.sequencer.view.getItemByIndex(
				gMediaCore.sequencer.viewPosition);
		} else if (!this.newMediaCore && gMediaCore.playing) {
			playing = true;
			currentItem = gMediaCore.playingView.mediaList
					.getItemByGuid(gMediaCore.currentGUID);
		}

		if (playing && currentItem.getProperty(this.onTourImgProperty) != ""
				&& currentItem.getProperty(this.onTourImgProperty) != null)
		{
			this._onTourIcon.style.visibility = "visible";
		}
	},
	
	// Our observer, we only use it for observing metadata.artist changes
	observe : function(aSubject, aTopic, aData) {
		if (aTopic == "metadata.artist" && aData != "") {
			var mainWin = Cc["@mozilla.org/appshell/window-mediator;1"]
					.getService(Ci.nsIWindowMediator)
					.getMostRecentWindow("Songbird:Main").window;
			var onTour = this.nrSvc.getTourStatus(aData);
			if (onTour)
				this._onTourIcon.style.visibility = "visible";
			else
				this._onTourIcon.style.visibility = "collapse";
		}
	},

	// The action that gets invoked when the user clicks on the On Tour icon
	loadArtist : function(e) {
		// Prevent the highlight-current-item action from firing
		e.stopPropagation();

		gMetrics.metricsInc("newReleases", "faceplate.link", "");
		// Load the artist event page into a new tab
		var item;
		if (NewReleases.newMediaCore)
			item = gMediaCore.sequencer.view.getItemByIndex(
				gMediaCore.sequencer.viewPosition);
		else
			item = gMediaCore.playingView.mediaList.getItemByGuid(
				gMediaCore.currentGUID);
		var city = Application.prefs.getValue("extensions.newreleases.city", 0);

		var url = item.getProperty(this.onTourUrlProperty);
		if (!url) {
			// if the track lacks an on tour property, then it's possible
			// it's from the web playlist.  we can make a best guess
			url = NewReleases.nrSvc
				.getArtistOnTourUrl(item.getProperty(SBProperties.artistName));
		}
		url += "?user_location=" + city;
		if (typeof(gBrowser) != "undefined") {
			// If we're in the main player, then open a tab
			gBrowser.loadOneTab(url);
		} else {
			// Otherwise open in the default browser
			SBOpenURLInDefaultBrowser(url);
		}
	},

	/***********************************************************************
	 * Called when the user clicks the On Tour icon in the library/playlist
	 **********************************************************************/
	playlistCellClick : function(e) {
		var prop = e.getData("property");
		var item = e.getData("item");
		var nrSvc = Cc["@songbirdnest.com/newreleases;1"]
			.getService(Ci.nsIClassInfo).wrappedJSObject;
		if (prop == nrSvc.onTourImgProperty) {
			var url = item.getProperty(nrSvc.onTourUrlProperty);
			var city =
				Application.prefs.getValue("extensions.newreleases.city", 0);
			url += "?user_location=" + city;
			gMetrics.metricsInc("newReleases", "library.link", "");
			gBrowser.loadOneTab(url);
		}
		e.stopPropagation();
	},

	/***********************************************************************
	 * Create the smart playlist for tracks by artists touring
	 **********************************************************************/
	_getOnTourPlaylist : function() {
		if (this.touringPlaylist != null)
			return this.touringPlaylist;

		try {
			var itemEnum = LibraryUtils.mainLibrary.getItemsByProperty(
					SBProperties.customType,
					"concerts_artistsTouring").enumerate();
			while (itemEnum.hasMoreElements()) {
				debugLog("_getOnTourPlaylist", "Smart playlist found");
				var list = itemEnum.getNext();
				this.touringPlaylist = list;
				return list;
			}
		} catch (e if e.result == Cr.NS_ERROR_NOT_AVAILABLE) {
		}
		
		debugLog("_getOnTourPlaylist", "No smart playlist found");
		return null;
	},

	rebuildOnTourPlaylist : function() {
		if (this.touringPlaylist != null) {
			debugLog("rebuildOnTourPlaylist", "Smart playlist rebuilt");
			this.touringPlaylist.rebuild();
		} else {
			debugLog("rebuildOnTourPlaylist", "Smart playlist is undefined");
		}
	},

	_setupOnTourPlaylist : function() {
		// See if we already have a playlist first
		var pls = this._getOnTourPlaylist();
		if (pls != null)
			return;

		// Now create our smart playlist
		var propMgr =
			Cc["@songbirdnest.com/Songbird/Properties/PropertyManager;1"]
			.getService(Ci.sbIPropertyManager);
		var tourPI = propMgr.getPropertyInfo(this.onTourImgProperty);
		var op = tourPI.getOperator(tourPI.OPERATOR_ISSET);
		
		var list = LibraryUtils.mainLibrary.createMediaList("smart");
		list.matchType = Ci.sbILocalDatabaseSmartMediaList.MATCH_TYPE_ALL;
		list.limitType = Ci.sbILocalDatabaseSmartMediaList.LIMIT_TYPE_NONE;
		list.limit = 0;
		list.name = this._strings.getString("playlistName");
		list.appendCondition(this.onTourImgProperty, op, null, null, null);
		list.setProperty(SBProperties.customType, "concerts_artistsTouring");
		list.setProperty(SBProperties.hidden, "0");
		list.autoUpdate = true;
		debugLog("_setupOnTourPlaylist", "List properties set");
		SmartMediaListColumnSpecUpdater.update(list);
		debugLog("_setupOnTourPlaylist", "List colspec updated");
		this.touringPlaylist = list;
		debugLog("_setupOnTourPlaylist", "Smart playlist created");

		this.uninstallObserver.list = list;
	},

	/*********************************************************************
	 * Setup listener for view changes so we can track the # of times the
	 * Artists on Tour smart playlist is played
	 *********************************************************************/
	_mmListener: {
		onMediacoreEvent : function(ev) {
			switch (ev.type) {
				case Components.interfaces.sbIMediacoreEvent.VIEW_CHANGE:
					this.onViewChange(ev.data);
					break;
				default:
					break;
			}
		},
		onStop : function() { },
		onBeforeTrackChange : function() { },
		onTrackChange : function() { },
		onTrackIndexChange : function() { },
		onBeforeViewChange : function() { },
		onViewChange : function(aView) {
			debugLog("viewChangeListener", "on view change triggered");
			var touringPlaylist = null;
			try {
				var itemEnum = LibraryUtils.mainLibrary.getItemsByProperty(
						SBProperties.customType,
						"concerts_artistsTouring").enumerate();
				while (itemEnum.hasMoreElements()) {
					touringPlaylist = itemEnum.getNext();
					break;
				}
			} catch (e if e.result == Cr.NS_ERROR_NOT_AVAILABLE) {
			}

			if (touringPlaylist == null)
				return;

			if (aView.mediaList.getProperty(SBProperties.outerGUID)
				== touringPlaylist.guid)
			{
				debugLog("viewChangeListener",
					"Artists on tour playback initiated");
				gMetrics.metricsInc("newReleases", "smartpls.played", "");
			}
		}
	},
}

NewReleases.uninstallObserver = {
	_uninstall : false,
	_disable : false,
	list : null,
	
	observe : function(subject, topic, data) {
		switch(topic) {
			case "em-action-requested":
				// Extension has been flagged to be uninstalled
				subject.QueryInterface(Ci.nsIUpdateItem);

				var SPS = Cc['@songbirdnest.com/servicepane/service;1'].
					getService(Ci.sbIServicePaneService);
				var newReleasesNode = SPS.getNode("urn:newreleases");

				if (subject.id == "newreleases@songbirdnest.com") {
					if (data == "item-uninstalled") {
						this._uninstall = true;
					} else if (data == "item-disabled") {
						this._disable = true;
						newReleasesNode.hidden = true;
					} else if (data == "item-cancel-action") {
						if (this._uninstall)
							this._uninstall = false;
						if (this._disable)
							newReleasesNode.hidden = false;
					}
				}
				break;
			case "songbird-library-manager-before-shutdown":
				//debugLog("observe", "About to fire cleanupPlaylists()");
				if (this._uninstall) {
					this.cleanupPlaylists(data);
				}
				break;
			case "quit-application-granted":
				if (this._uninstall)
					this.uninstallCleanup();
				break;
		}
	},

	register : function() {
		var observerService = Cc["@mozilla.org/observer-service;1"]
			.getService(Ci.nsIObserverService);
		observerService.addObserver(this, "em-action-requested", false);
		observerService.addObserver(this, "quit-application-granted", false);
		observerService.addObserver(this,
				"songbird-library-manager-before-shutdown", false);
		this.observerService = observerService;

		// Save a pointer to the main library
		this.mainLib = Cc['@songbirdnest.com/Songbird/library/Manager;1']
			.getService(Ci.sbILibraryManager).mainLibrary;
	},

	unregister : function() {
		this.observerService.removeObserver(this, "em-action-requested");
		this.observerService.removeObserver(this, "quit-application-granted");
	},

	cleanupPlaylists : function(libraryManager) {
		this.observerService.removeObserver(this,
				"songbird-library-manager-before-shutdown");
		// 4) Remove the Artists On Tour smart playlist
		if (this.list != null)
			this.mainLib.remove(this.list);
	},
	
	uninstallCleanup : function() {
		// Cleanup after ourselves
		// We need to do a few things:
		// 1) Remove service pane node for New Releases
		// 2) Remove New Releases prefs
		// 3) Remove "On Tour" property from library if it's visible

		// Keep a count of when it was uninstalled
		gMetrics.metricsInc("newReleases", "uninstall", "");
		
		// 1) Remove service pane node
		var SPS = Cc['@songbirdnest.com/servicepane/service;1']
			.getService(Ci.sbIServicePaneService);
		var newReleasesNode = SPS.getNode("urn:newreleases");
		SPS.removeNode(newReleasesNode);

		// find the services node, if it has any visible children then leave
		// it visible - otherwise hide it
		var servicesNode = SPS.getNode("SB:Services");
		var visible = false;
		var enum = servicesNode.childNodes;
		while (enum.hasMoreElements()) {
			var node = enum.getNext();
			if (!node.hidden) {
				visible = true;
				break;
			}
		}
		servicesNode.hidden = !visible;

		// 2) Remove New Releases prefs
		var prefs = Cc["@mozilla.org/preferences-service;1"]
			.getService(Ci.nsIPrefService).getBranch("extensions.newreleases.");
		if (prefs.prefHasUserValue("showplaylink"))
			prefs.clearUserPref("showplaylink");
		if (prefs.prefHasUserValue("showgcal"))
			prefs.clearUserPref("showgcal");
		if (prefs.prefHasUserValue("epic"))
			prefs.clearUserPref("epic");
		if (prefs.prefHasUserValue("lastupdated"))
			prefs.clearUserPref("lastupdated");
		if (prefs.prefHasUserValue("forcerefresh"))
			prefs.clearUserPref("forcerefresh");
		if (prefs.prefHasUserValue("citypage"))
			prefs.clearUserPref("citypage");
		if (prefs.prefHasUserValue("locations.lastupdated"))
			prefs.clearUserPref("locations.lastupdated");
		if (prefs.prefHasUserValue("locations.forcerefresh"))
			prefs.clearUserPref("locations.forcerefresh");
		prefs.deleteBranch("");
		
		// 3) Remove "On Tour" property from library colspec
		var nrSvc = Cc["@songbirdnest.com/newreleases;1"]
			.getService(Ci.nsIClassInfo).wrappedJSObject;
		var mainLib = Cc['@songbirdnest.com/Songbird/library/Manager;1']
			.getService(Ci.sbILibraryManager).mainLibrary;
		var colSpec = mainLib.getProperty(SBProperties.columnSpec);
		var propRe = new RegExp("\\s+"+nrSvc.onTourImgProperty+" \\d+","g");
		if (colSpec.indexOf(nrSvc.onTourImgProperty)) {
			colSpec = colSpec.replace(propRe, "");
			mainLib.setProperty(SBProperties.columnSpec, colSpec);
		}
		var colSpec = mainLib.getProperty(SBProperties.defaultColumnSpec);
		if (colSpec.indexOf(nrSvc.onTourImgProperty)) {
			colSpec = colSpec.replace(propRe, "");
			mainLib.setProperty(SBProperties.defaultColumnSpec, colSpec);
		}
	},
}

window.addEventListener("load", function(e) { NewReleases.onLoad(e); }, false);
window.addEventListener("unload", function(e) { NewReleases.onUnLoad(e); }, false);
