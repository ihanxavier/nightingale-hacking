// JScript source code
/*
//
// BEGIN SONGBIRD GPL
// 
// This file is part of the Songbird web player.
//
// Copyright� 2006 Pioneers of the Inevitable LLC
// http://songbirdnest.com
// 
// This file may be licensed under the terms of of the
// GNU General Public License Version 2 (the �GPL�).
// 
// Software distributed under the License is distributed 
// on an �AS IS� basis, WITHOUT WARRANTY OF ANY KIND, either 
// express or implied. See the GPL for the specific language 
// governing rights and limitations.
//
// You should have received a copy of the GPL along with this 
// program. If not, go to http://www.gnu.org/licenses/gpl.html
// or write to the Free Software Foundation, Inc., 
// 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.
// 
// END SONGBIRD GPL
//
 */

//
//  Yes, I know this file is a mess.
//
//  Yes, I know we have to clean it up.
//
//  Yes, this will happen soon.
//
//  I promise.  Or something.
//
//                  - mig
//


try
{
const LOAD_FLAGS_BYPASS_HISTORY = 64;

// okay
var thePlaylistReader = null;

// Hooray for event handlers!
function myPlaybackEvent( key, value )
{
}

// NOW we have the playlist playback service!
var gPPS = Components.classes["@songbird.org/Songbird/PlaylistPlayback;1"]
                      .getService(Components.interfaces.sbIPlaylistPlayback);



var theSongbirdStrings = document.getElementById( "songbird_strings" );

var SBWindowMinMaxCB = 
{
  // Shrink until the box doesn't match the window, then stop.
  GetMinWidth: function()
  {
    // What we'd like it to be
    var retval = 750;
    // However, if in resizing the window size is different from the document's box object
    if (window.innerWidth != document.getElementById('window_parent').boxObject.width)
    { 
      // That means we found the document's min width.  Because you can't query it directly.
      retval = document.getElementById('window_parent').boxObject.width - 1;
    }
    return retval;
  },

  GetMinHeight: function()
  {
    // What we'd like it to be
    var retval = 400;
    // However, if in resizing the window size is different from the document's box object
    if (window.innerHeight != document.getElementById('window_parent').boxObject.height)
    { 
      // That means we found the document's min width.  Because you can't query it directly.
      retval = document.getElementById('window_parent').boxObject.height - 1;
    }
    return retval;
  },

  GetMaxWidth: function()
  {
    return -1;
  },

  GetMaxHeight: function()
  {
    return -1;
  },

  OnWindowClose: function()
  {
    setTimeout(quitApp, 0);
  },

  QueryInterface : function(aIID)
  {
    if (!aIID.equals(Components.interfaces.sbIWindowMinMaxCallbacl) &&
        !aIID.equals(Components.interfaces.nsISupportsWeakReference) &&
        !aIID.equals(Components.interfaces.nsISupports)) 
    {
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    
    return this;
  }
}

function setMinMaxCallback()
{
  try {
    var windowMinMax = Components.classes["@songbird.org/Songbird/WindowMinMax;1"].getService(Components.interfaces.sbIWindowMinMax);
    windowMinMax.SetCallback(document, SBWindowMinMaxCB);
  }
  catch (e) {
    // No component
  }
}

function checkAltF4(evt)
{
  if (evt.keyCode == 0x73 && evt.altKey) 
  {
    evt.preventDefault();
    quitApp();
  }
}

/**
* Convert a string containing binary values to hex.
*/
function binaryToHex(input)
{
  var result = "";
  
  for (var i = 0; i < input.length; ++i) 
  {
    var hex = input.charCodeAt(i).toString(16);
  
    if (hex.length == 1)
      hex = "0" + hex;
  
    result += hex;
  }
  
  return result;
}

function SBFirstRunPong()
{
  try
  {
    const pongURL = "http://www.songbirdnest.com/player/pong/";
    
    var firstRun = new sbIDataRemote("application.first_run");
    var firstRunVersion = new sbIDataRemote("application.version");
    
    var isFirst = firstRun.getValue();
    var theVersion = firstRunVersion.getValue();

    if(isFirst != "false" ||
       theVersion != "0.1.1" )
    {
      var playerUUID = new sbIDataRemote("application.uuid");

      var newUUID = playerUUID.getValue()
      if(newUUID == "")
      {
        var aUUIDGenerator = Components.classes["@mozilla.org/uuid-generator;1"].createInstance(Components.interfaces.nsIUUIDGenerator);

        newUUID = aUUIDGenerator.generateUUID();
        playerUUID.setValue(newUUID);
      }

      var pongRequest = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Components.interfaces.nsIXMLHttpRequest);
      var pongHash = Components.classes["@mozilla.org/security/hash;1"].createInstance(Components.interfaces.nsICryptoHash);
      var inputStream = Components.classes["@mozilla.org/io/string-input-stream;1"].createInstance(Components.interfaces.nsIStringInputStream);
      const confirmShakePhrase = "army of darkness rulez";
      
      inputStream.setData(newUUID, -1);
      
      pongHash.initWithString("SHA1");
      pongHash.updateFromStream(inputStream, -1);
      var uuidHash = binaryToHex(pongHash.finish(false));
      
      var confirmShake = uuidHash + confirmShakePhrase;
      inputStream.setData(confirmShake, -1);
      
      pongHash.initWithString("SHA1");
      pongHash.updateFromStream(inputStream, -1);
      var confirmHash = binaryToHex(pongHash.finish(false));
     
      var message = "&i=" + uuidHash + "&c=" + confirmHash + "&v=0_1_1";
      var requestURL = pongURL + "?" + message;
       
      pongRequest.open("GET", requestURL, false);
      pongRequest.send(null);
      
      if(pongRequest.status == 204)
      {
        dump("Success!!!");
        firstRun.setValue("false");
        firstRunVersion.setValue("0.1.1");
      }
      else
      {
        dump(newUUID + "\n");
        dump(message + "\n");
        dump(requestURL + "\n");
        dump(pongRequest.status + "\n");
      }
    }
  }
  catch ( err )
  {
    // This can happen if there is not internet connection.  Yay.  Fail silent.
    alert( "*** SBFirstRun ***\n\n" + err );
  }
}

//
// Core Wrapper Initialization (in XUL, this must happen after the entire page loads). 
//
var Poll = null;
var theWebPlaylist = null;
var theWebPlaylistQuery = null;
function SBInitialize()
{
  dump("SBInitialize *** \n");

  SBFirstRunPong();

  const MediaLibrary = new Components.Constructor("@songbird.org/Songbird/MediaLibrary;1", "sbIMediaLibrary");
  const PlaylistManager = new Components.Constructor("@songbird.org/Songbird/PlaylistManager;1", "sbIPlaylistManager");
  const PlaylistReaderManager = new Components.Constructor("@songbird.org/Songbird/PlaylistReaderManager;1", "sbIPlaylistReaderManager");
  thePlaylistReader = (new PlaylistReaderManager()).QueryInterface(Components.interfaces.sbIPlaylistReaderManager);

  try
  {
    onWindowLoadSize();
    setMinMaxCallback();
    SBInitMouseWheel();
    setMediaKeyboardCallback();
    initJumpToFileHotkey();

    if (window.addEventListener)
      window.addEventListener("keydown", checkAltF4, true);

    // Make sure we have a fake database in which to play
    var aDBQuery = Components.classes["@songbird.org/Songbird/DatabaseQuery;1"];
    if (aDBQuery)
    {
      aDBQuery = aDBQuery.createInstance();
      aDBQuery = aDBQuery.QueryInterface(Components.interfaces.sbIDatabaseQuery);
      aDBQuery.SetAsyncQuery(false);
      aDBQuery.SetDatabaseGUID("testdb-0000");
      aDBQuery.AddQuery("create table test (idx integer primary key autoincrement, url text, name text, tim text, artist text, album text, genre text)");
      aDBQuery.AddQuery("create index testindex on test(idx, url, name, tim, artist, album, genre)");
      
      var ret = aDBQuery.Execute();
      
      // If it actually worked, that means we created the database
      // ask the user if they would like to fill their empty bucket.
      if ( ret == 0 )
      {
        theMediaScanIsOpen.setValue( true );
        setTimeout( SBScanMedia, 1000 );
      }
    }
    
    // Install listeners on the main pane.
    var theMainPane = document.getElementById("frame_main_pane");
    if (!mainpane_listener_set)
    {
      mainpane_listener_set = false;
      if (theMainPane.addEventListener) {
        theMainPane.addEventListener("DOMContentLoaded", onMainPaneLoad, false);
        theMainPane.addEventListener("unload", onMainPaneUnload, true);
        theMainPane.addProgressListener(SBDocStartListener);
      }
    }
    
    var theServiceTree = document.getElementById( 'frame_servicetree' );
    theServiceTree.init(theMainPane);
    theServiceTree.setPlaylistPopup(document.getElementById( "service_popup_playlist" ));
    theServiceTree.setSmartPlaylistPopup(document.getElementById( "service_popup_smart" ));
    //theServiceTree.setDefaultPopup(document.getElementById( "?" ));
    theServiceTree.setNotAnItemPopup(document.getElementById( "service_popup_none" ));
    theServiceTree.onPlaylistHide = onBrowserPlaylistHide;
    onServiceTreeRestoreSize();

    theWebPlaylist = document.getElementById( "playlist_web" );
    // hack, to let play buttons find the visible playlist if needed
    document.__CURRENTWEBPLAYLIST__ = theWebPlaylist;
    theWebPlaylist.addEventListener( "playlist-play", onPlaylistPlay, true );
// no!    theWebPlaylist.addEventListener( "playlist-edit", onPlaylistEdit, true );
    theWebPlaylist.addEventListener( "command", onPlaylistContextMenu, false );  // don't force it!
    theWebPlaylist.setDnDSourceTracker(sbDnDSourceTracker);
    
    // Poll the playlist source every 500ms to drive the display update (STOOOOPID!)
    Poll = new sbIPlaylistsource();
    var NumPlaylistItemsRemote = new sbIDataRemote( "playlist.numitems" );
    NumPlaylistItemsRemote.setValue( "" );
    function PFU()
    {
      try
      {
        // Display the number of items in the currently viewed playlist.
        var tree_ref = "";
        var display_string = "";
        // thePlaylistTree is non-null when a playlist is showing.
        if ( thePlaylistTree )
        {
          tree_ref = thePlaylistTree.getAttribute( "ref" );
        }
        else if ( theWebPlaylistQuery )
        {
          // If there's a web playlist query, then we can pop the webplaylist.
          var mediafound = "Media Found";
          try
          {
            mediafound = theSongbirdStrings.getString("faceplate.mediafound");
          } catch(e) {}
          var pct = parseInt( SBDataGetValue( "webplaylist.current" ) * 100 / SBDataGetValue( "webplaylist.total" ) );
          if ( pct < 100 )
          {
            display_string = mediafound + " " + pct + "%";
          }
          else
          {
            tree_ref = theWebPlaylist.ref;
          }
        }
        
        if ( tree_ref.length )
        {
          var rows = Poll.GetRefRowCount( tree_ref );
          if ( rows > 0 )
          {
            var items = "items";
            try
            {
              items = theSongbirdStrings.getString("faceplate.items");
            } catch(e) {}
            display_string = rows + " " + items;
          }
        }
        
        NumPlaylistItemsRemote.setValue( display_string );
      }
      catch ( err )
      {
        alert( "PFU - " + err );
      }
    }    
    setInterval( PFU, 500 );
    
//    
// Let's test loading all sorts of random urls as if they were playlists!    
//    var the_url = "ftp://ftp.openbsd.org/pub/OpenBSD/songs";
//    var the_url = "http://www.blogotheque.net/mp3/";
//    var the_url = "file:///c:\\vice.html";
//    var the_url = "http://odeo.com/channel/38104/rss";
//    var the_url = "http://takeyourmedicinemp3.blogspot.com/atom.xml";
//    var success = thePlaylistReader.AutoLoad(the_url, "songbird", ConvertUrlToDisplayName( the_url ), "http", the_url, "", null);

/*
    try
    {
      const MetadataManager = new Components.Constructor("@songbird.org/Songbird/MetadataManager;1", "sbIMetadataManager");
      var aMetadataManager = new MetadataManager();
      aMetadataHandler = aMetadataManager.GetHandlerForMediaURL("http://www.morphius.com/label/mp3/Labtekwon_RealEmcee.mp3");
      //aMetadataHandler = aMetadataManager.GetHandlerForMediaURL("file://c:/junq/01_The_Gimp_Sometimes.mp3");
      var retval = aMetadataHandler.Read();
      
      function PollMetadata( )
      {
        if ( aMetadataHandler.IsExecuting() )
        {
          setTimeout( PollMetadata, 500 );
        }
        else
        {
          var values = aMetadataHandler.getValuesMap();
          
          var text = "";
          const keys = new Array("title", "length", "album", "artist", "genre", "year", "composer");
          for ( var i in keys )
          {
            text += keys[ i ] + ": " + values.getValue( keys[ i ] ) + "\n";
          }
          alert( text );
        }
      }
      setTimeout( PollMetadata, 500 );
    }
    catch(err)
    {
      alert("songbird_hack.js - SBInitialize - " +  err);
    }
*/

  }
  catch(err)
  {
    alert("songbird_hack.js - SBInitialize - " +  err);
  }
}

var aMetadataHandler = null;

function SBUninitialize()
{
  resetJumpToFileHotkey();
  closeJumpTo();
  resetMediaKeyboardCallback();
  try
  {
    var windowMinMax = Components.classes["@songbird.org/Songbird/WindowMinMax;1"].getService(Components.interfaces.sbIWindowMinMax);
    windowMinMax.ResetCallback(document);  
  }
  catch(e)
  {
  
  }
}


/**
 * Closes the current window and launches the selected mainwin url
 */
function SBMainWindowReopen()
{
  // Get mainwin URL
  var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
  var mainwin = "chrome://songbird/content/xul/mainwin.xul";
  try {
    mainwin = prefs.getCharPref("general.bones.selectedMainWinURL", mainwin);  
  } catch (err) {}

  // Open the window
  window.open( mainwin, "", "chrome,modal=no" );
  setTimeout( "onExit();", 1000 );
}


 
//
// XUL Event Methods
//

//Necessary when WindowDragger is not available on the current platform.
var trackerBkg = false;
var offsetScrX = 0;
var offsetScrY = 0;

// The background image allows us to move the window around the screen
function onBkgDown( theEvent ) 
{
  try
  {
    var windowDragger = Components.classes["@songbird.org/Songbird/WindowDragger;1"].getService(Components.interfaces.sbIWindowDragger);
    windowDragger.BeginWindowDrag(0); // automatically ends
  }
  catch(e)
  {
    trackerBkg = true;
    offsetScrX = document.defaultView.screenX - theEvent.screenX;
    offsetScrY = document.defaultView.screenY - theEvent.screenY;
    document.addEventListener( "mousemove", onBkgMove, true );
  }
}

function onBkgMove( theEvent ) 
{
  if ( trackerBkg )
  {
    document.defaultView.moveTo( offsetScrX + theEvent.screenX, offsetScrY + theEvent.screenY );
  }
}

function onBkgUp( ) 
{
  var root = "window." + document.documentElement.id;
  SBDataSetValue( root + ".x", document.documentElement.boxObject.screenX );
  SBDataSetValue( root + ".y", document.documentElement.boxObject.screenY );
  
  if ( trackerBkg )
  {
    trackerBkg = false;
    document.removeEventListener( "mousemove", onBkgMove, true );
  }
}

function saveWindowPosition()
{
  var root = "window." + document.documentElement.id;
  SBDataSetValue( root + ".x", document.documentElement.boxObject.screenX );
  SBDataSetValue( root + ".y", document.documentElement.boxObject.screenY );
  SBDataSetValue( root + ".w", document.documentElement.boxObject.width );
  SBDataSetValue( root + ".h", document.documentElement.boxObject.height );
}

function switchFeathers(internalName)
{
  var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
  var curfeathers = "rubberducky";
  try {
    curfeathers = prefs.getCharPref("general.skins.selectedSkin", internalName);  
  } catch (err) {}
  if (curfeathers == internalName) return;
  onMinimize();
  prefs.setCharPref("general.skins.selectedSkin", internalName);  
  
  SBMainWindowReopen();
}

// old version, just in case
/*var trackerBkg = false;
var offsetScrX = 0;
var offsetScrY = 0;
function onBkgDown( theEvent ) 
{
  trackerBkg = true;
  offsetScrX = document.defaultView.screenX - theEvent.screenX;
  offsetScrY = document.defaultView.screenY - theEvent.screenY;
  document.addEventListener( "mousemove", onBkgMove, true );
}

function onBkgMove( theEvent ) 
{
  if ( trackerBkg )
  {
    document.defaultView.moveTo( offsetScrX + theEvent.screenX, offsetScrY + theEvent.screenY );
  }
}
function onBkgUp( ) 
{
  if ( trackerBkg )
  {
    trackerBkg = false;
    document.removeEventListener( "mousemove", onBkgMove, true );
  }
}*/


var URL = new sbIDataRemote("faceplate.play.url");
var thePlaylistIndex = new sbIDataRemote( "playlist.index" );
var seen_playing = new sbIDataRemote("faceplate.seenplaying");

var theTitleText = new sbIDataRemote( "metadata.title" );
var theArtistText = new sbIDataRemote( "metadata.artist" );
var theAlbumText = new sbIDataRemote( "metadata.album" );
var theStatusText = new sbIDataRemote( "faceplate.status.text" );
var theStatusStyle = new sbIDataRemote( "faceplate.status.style" );

// Help
function onHelp()
{
  alert( "Aieeeeee, ayudame!" );
}

var theCurrentTrackInterval = null;
function onCurrentTrack()
{
  if ( theCurrentTrackInterval )
  {
    clearInterval( theCurrentTrackInterval );
  }

  var guid;
  var table;
  var ref = SBDataGetValue("playing.ref");
  if (ref != "") {
    source_ref = ref;
    var source = new sbIPlaylistsource();
    guid = source.GetRefGUID( ref );
    table = source.GetRefTable( ref );
  } else {
    source_ref = "NC:songbird_library";
    guid = "songbird";
    table = "library";
  }
  
  if ( thePlaylistTree ) {
    var curplaylist = document.__CURRENTPLAYLIST__;
    if (curplaylist && curplaylist.ref == source_ref) {
      curplaylist.syncPlaylistIndex(true);
      return;
    }
  }
  
  var theServiceTree = document.getElementById( 'frame_servicetree' );
  if (guid == "songbird" && table == "library") { 
    theServiceTree.launchServiceURL( "chrome://songbird/content/xul/main_pane.xul?library" );
  }
  else 
  {
    theServiceTree.launchServiceURL( "chrome://songbird/content/xul/main_pane.xul?" + table+ "," + guid);
  } 
  theCurrentTrackInterval = setInterval( onCurrentTrack, 500 );
}

var FaceplateStateData = new sbIDataRemote( "faceplate.state" );

function onNextService()
{
  FaceplateStateData.setValue( ( FaceplateStateData.getIntValue() + 1 ) % 2 ); // can't use boolean, must use integer logic
}

// onServiceTreeResize
function onServiceTreeResize()
{
  var theServiceTree = document.getElementById( "frame_servicetree" );
  SBDataSetValue( "servicetree.width", theServiceTree.width );
  var collapsed = theServiceTree.nextSibling.getAttribute( "state" ) == "collapsed";
  if (collapsed && SBDataGetIntValue("servicetree.collapsed") == 0) metrics_inc("player", "collapse.servicetree", null);
  SBDataSetValue( "servicetree.collapsed", collapsed );
}

// onServiceTreeRestoreSize
function onServiceTreeRestoreSize()
{
  var theServiceTree = document.getElementById( "frame_servicetree" );
  var width = SBDataGetValue( "servicetree.width" );
  if ( width != "" )
  {
    theServiceTree.width = width;
    theServiceTree.nextSibling.setAttribute( "state", SBDataGetIntValue( "servicetree.collapsed" ) ? "collapsed" : "open" );
  }
}

function onServiceTreeCommand( theEvent )
{
  if ( theEvent && theEvent.target )
  {
    // These attribs get set when the menu is popped up on a playlist.
    var label = theEvent.target.parentNode.getAttribute( "label" );
    var guid = theEvent.target.parentNode.getAttribute( "sb_guid" );
    var table = theEvent.target.parentNode.getAttribute( "sb_table" );
    var type = theEvent.target.parentNode.getAttribute( "sb_type" );
    var base_type = theEvent.target.parentNode.getAttribute( "sb_base_type" );
    switch ( theEvent.target.id )
    {
      case "service_popup_new":
        SBNewPlaylist();
      break;
      case "service_popup_new_smart":
        SBNewSmartPlaylist();
      break;
      case "service_popup_new_remote":
        SBSubscribe( "", "", "", "" );
      break;
      
      case "playlist_context_smartedit":
        if ( base_type == "smart" )
        {
          if ( guid && guid.length > 0 && table && table.length > 0 )
          {
            SBNewSmartPlaylist( guid, table );
          }
        }
        if ( base_type == "dynamic" )
        {
          if ( guid && guid.length > 0 && table && table.length > 0 )
          {
            SBSubscribe( type, guid, table, label );
          }
        }
      break;
      
      case "playlist_context_rename":
        if ( guid && guid.length > 0 && table && table.length > 0 )
        {
          onServiceEdit();
        }
      break;
      
      case "playlist_context_remove":
        if ( guid && guid.length > 0 && table && table.length > 0 )
        {
          // Assume we'll need this...
          const PlaylistManager = new Components.Constructor("@songbird.org/Songbird/PlaylistManager;1", "sbIPlaylistManager");
          var aPlaylistManager = new PlaylistManager();
          aPlaylistManager = aPlaylistManager.QueryInterface(Components.interfaces.sbIPlaylistManager);
          var aDBQuery = new sbIDatabaseQuery();
          
          aDBQuery.SetAsyncQuery(false);
          aDBQuery.SetDatabaseGUID(guid);

          switch ( base_type )
          {
            case "simple":
              aPlaylistManager.DeleteSimplePlaylist(table, aDBQuery);
              break;
            case "dynamic":
              aPlaylistManager.DeleteDynamicPlaylist(table, aDBQuery);
              break;
            case "smart":
              aPlaylistManager.DeleteSmartPlaylist(table, aDBQuery);
              break;
            default:
              aPlaylistManager.DeletePlaylist(table, aDBQuery);
              break;
          }
        }
      break;
    }
  }
}

var theServiceTreeScanItems = new Array();
var theServiceTreeScanCount = 0;
function SBScanServiceTreeNewEntryEditable()
{
  var theServiceTree = document.getElementById( "frame_servicetree" );
  theServiceTreeScanItems.length = 0;
  theServiceTreeScanCount = 0;
  
  // Go get all the current service tree urls.
  var theServiceTree_tree = theServiceTree.tree;
  for ( var i = 0; i < theServiceTree_tree.view.rowCount; i++ )
  {
    theServiceTreeScanItems.push( theServiceTree_tree.contentView.getItemAtIndex( i ).getAttribute( "url" ) );
  }
}

function SBScanServiceTreeNewEntryStart()
{
  setTimeout( SBScanServiceTreeNewEntryCallback, 500 );
}

function SBScanServiceTreeNewEntryCallback()
{
  var theServiceTree = document.getElementById( "frame_servicetree" );
  
  if ( ++theServiceTreeScanCount > 10 )
  {
    return; // don't loop more than 1 second.
  }
  
  // Go through all the current service tree items.
  var done = false;
  var theServiceTree_tree = theServiceTree.tree;
  for ( var i = 0; i < theServiceTree_tree.view.rowCount; i++ )
  {
    var found = false;
    var url = theServiceTree_tree.contentView.getItemAtIndex( i ).getAttribute( "url" );
    // Match them against the scan items
    for ( var j = 0; j < theServiceTreeScanItems.length; j++ )
    {
      if ( url == theServiceTreeScanItems[ j ] )
      {
        found = true;
        break;
      }
    }
    // Right now, only songbird playlists are editable.
    if ( ( ! found ) && ( url.indexOf( ",songbird" ) != -1 ) )
    {
      // This must be the new one?
      theServiceTree_tree.view.selection.currentIndex = i;
      
      // HACK: flag to prevent the empty playlist from launching on select
      theServiceTree_tree.newPlaylistCreated = true;
      theServiceTree_tree.view.selection.select( i );
      theServiceTree_tree.newPlaylistCreated = false;
      
      onServiceEdit();
      done = true;
      break;
    }
  }
  if ( ! done )
  {
    setTimeout( SBScanServiceTreeNewEntryCallback, 100 );
  }
}

function onServiceEdit()
{
  try
  {
    var theServiceTree = document.getElementById( "frame_servicetree" );
    if ( theServiceTree)
    {
      var theServiceTree_tree = theServiceTree.tree;
      if ( theServiceTree_tree && theServiceTree_tree.currentIndex > -1 )
      {
        var column = theServiceTree_tree.columns ? theServiceTree_tree.columns["frame_service_tree_label"] : "frame_service_tree_label";
        var cell_text = theServiceTree_tree.view.getCellText( theServiceTree_tree.currentIndex, column );

        // This is nuts!
        var text_x = {}, text_y = {}, text_w = {}, text_h = {}; 
        theServiceTree_tree.treeBoxObject.getCoordsForCellItem( theServiceTree_tree.currentIndex, column, "text",
                                                            text_x , text_y , text_w , text_h );
        var cell_x = {}, cell_y = {}, cell_w = {}, cell_h = {}; 
        theServiceTree_tree.treeBoxObject.getCoordsForCellItem( theServiceTree_tree.currentIndex, column, "cell",
                                                            cell_x , cell_y , cell_w , cell_h );
        var image_x = {}, image_y = {}, image_w = {}, image_h = {}; 
        theServiceTree_tree.treeBoxObject.getCoordsForCellItem( theServiceTree_tree.currentIndex, column, "image",
                                                            image_x , image_y , image_w , image_h );
        var twisty_x = {}, twisty_y = {}, twisty_w = {}, twisty_h = {}; 
        theServiceTree_tree.treeBoxObject.getCoordsForCellItem( theServiceTree_tree.currentIndex, column, "twisty",
                                                            twisty_x , twisty_y , twisty_w , twisty_h );
        var out_x = {}, out_y = {}, out_w = {}, out_h = {};
        
        out_x = text_x;
        out_y = cell_y;
        out_w.value = cell_w.value - twisty_w.value - image_w.value;
        out_h = cell_h;
        
        // Then pop the edit box to the bounds of the cell.
        var theEditPopup = document.getElementById( "service_edit_popup" );
        var theEditBox = document.getElementById( "service_edit" );
        var extra_x = 3; // Why do I have to give it extra?  What am I calculating wrong?
        var extra_y = 8; // Why do I have to give it extra?  What am I calculating wrong?
        var less_w  = 5;
        var less_h  = 0;
        var pos_x = extra_x + theServiceTree_tree.boxObject.screenX + out_x.value;
        var pos_y = extra_y + theServiceTree_tree.boxObject.screenY + out_y.value;
        theEditBox.setAttribute( "hidden", "false" );
        theEditPopup.showPopup( theServiceTree_tree, pos_x, pos_y, "popup" );
        theEditPopup.sizeTo( out_w.value - less_w, out_h.value - less_h ); // increase the width to the size of the cell.
        theEditBox.value = cell_text;
        theEditBox.focus();
        theEditBox.select();
        isServiceEditShowing = true;
      }
    }
  }
  catch ( err )
  {
    alert( "onServiceEdit - " + err );
  }
}

function onServiceEditChange( evt )
{
  try
  {
    var theServiceTree = document.getElementById( "frame_servicetree" );
    if ( theServiceTree)
    {
      var theServiceTree_tree = theServiceTree.tree;
      if ( theServiceTree_tree && theServiceTree_tree.currentIndex > -1 )
      {
        var theEditBox = document.getElementById( "service_edit" );

        var element = theServiceTree_tree.contentView.getItemAtIndex( theServiceTree_tree.currentIndex );
        var properties = element.getAttribute( "properties" ).split(" ");
        if ( properties.length >= 5 )
        {
          var table = properties[ 1 ];
          var guid = properties[ 2 ];
          var type = properties[ 3 ];
          var base_type = properties[ 4 ];
          
          const PlaylistManager = new Components.Constructor("@songbird.org/Songbird/PlaylistManager;1", "sbIPlaylistManager");
          var aPlaylistManager = (new PlaylistManager()).QueryInterface(Components.interfaces.sbIPlaylistManager);
          var aDBQuery = new sbIDatabaseQuery();
          
          aDBQuery.SetAsyncQuery(false);
          aDBQuery.SetDatabaseGUID(guid);
          
          var playlist = null;
          
          // How do I edit a table's readable name?  I have to know what type it is?  Ugh.
          switch ( base_type )
          {
            case "simple":  playlist = aPlaylistManager.GetSimplePlaylist(table, aDBQuery);  break;
            case "dynamic": playlist = aPlaylistManager.GetDynamicPlaylist(table, aDBQuery); break;
            case "smart":   playlist = aPlaylistManager.GetSmartPlaylist(table, aDBQuery);   break;
            default:        playlist = aPlaylistManager.GetPlaylist(table, aDBQuery);        break;
          }
          
          if(playlist)
          {
            var strReadableName = evt.target.value;
            playlist.SetReadableName(strReadableName);
          }
        }      
        HideServiceEdit();
      }
    }
  }
  catch ( err )
  {
    alert( "onServiceEditChange\n\n" + err );
  }
}

function onServiceEditKeypress( evt )
{
  switch ( evt.keyCode )
  {
    case 27: // Esc
      HideServiceEdit();
      break;
    case 13: // Return
      onServiceEditChange( evt );
      break;
  }
}

var isServiceEditShowing = false;
function HideServiceEdit()
{
  try
  {
    if ( isServiceEditShowing )
    {
      var theEditBox = document.getElementById( "service_edit" );
      theEditBox.setAttribute( "hidden", "true" );
      var theEditPopup = document.getElementById( "service_edit_popup" );
      theEditPopup.hidePopup();
      isServiceEditShowing = false;        
    }
  }
  catch ( err )
  {
    alert( "HideServiceEdit\n\n" + err );
  }
}

var theCanGoBackData = new sbIDataRemote("browser.cangoback");
var theCanGoFwdData = new sbIDataRemote("browser.cangofwd");
var theCanAddToPlaylistData = new sbIDataRemote( "browser.canplaylist" );
var theBrowserUrlData = new sbIDataRemote( "browser.url.text" );
var theBrowserImageData = new sbIDataRemote( "browser.url.image" );
var theBrowserUriData = new sbIDataRemote( "browser.uri" );
var theShowWebPlaylistData = new sbIDataRemote( "browser.playlist.show" );

var SBDocStartListener = {

  m_CurrentRequestURI: "",
  
  QueryInterface : function(aIID) {
    if (!aIID.equals(Components.interfaces.nsIWebProgressListener) &&
        !aIID.equals(Components.interfaces.nsISupportsWeakReference) &&
        !aIID.equals(Components.interfaces.nsISupports)) 
    {
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    return this;
  },

  onStateChange : function( aWebProgress, aRequest, aState, aStatus ) 
  {
    const STATE_STOP = 0x10;
    const STATE_IS_DOCUMENT = 0x20000;

    try
    {
      if ( ( ( aState & ( STATE_STOP | STATE_IS_DOCUMENT ) ) != 0 ) && ( aStatus == 0x804B001E ) ) // ? 0x804B001E?
      {
      var theServiceTree = document.getElementById( 'frame_servicetree' );
      theServiceTree.launchURL( "chrome://songbird/content/html/cannot_load.html" );
      }
    }
    catch ( err )
    {
      alert( "onStateChange - " + err );
    }
  },
  
  onStatusChange : function( aWebProgress, aRequest, aLocation ) 
  {
  },
  
  onProgressChange : function( aWebProgress, aRequest, aLocation ) 
  {
  },
  
  onSecurityChange : function( aWebProgress, aRequest, aLocation ) 
  {
  },
  
  onLocationChange : function( aWebProgress, aRequest, aLocation ) 
  {
    try
    {
      // Set the value in the text box (shown or not)
      var theServiceTree = document.getElementById( "frame_servicetree" );
      var theMainPane = document.getElementById( "frame_main_pane" );
      var cur_uri = aLocation.asciiSpec;
      m_CurrentRequestURI = aRequest.name;
//      if ( SBGetUrlFromService( theBrowserUrlData.getValue() ) != cur_uri )
      {
        // Set the box
        theBrowserUriData.setValue( cur_uri );
        theBrowserUrlData.setValue( SBGetServiceFromUrl( cur_uri ) );
        var image = SBGetServiceImageFromUrl( cur_uri );
        if ( image.length )
        {
          theBrowserImageData.setValue( image );
        }
        
        // Set the buttons based on the session history.
        if ( theMainPane.webNavigation.sessionHistory )
        {
          // Check the buttons
          theCanGoBackData.setValue( theMainPane.webNavigation.canGoBack );
          theCanGoFwdData.setValue( theMainPane.webNavigation.canGoForward )
        }
        else
        {
          // Error?
        }

/*        
        // Hide or show the HTML box based upon whether or not the loaded page is .xul (lame heuristic)
        var theHTMLBox = document.getElementById( "frame_main_pane_html" );
        if ( theHTMLBox )
        {
          if ( cur_uri.indexOf(".xul") != -1 )
          {
            if ( SBDataGetIntValue( "option.htmlbar" ) == 0 )
            {
              theHTMLBox.setAttribute( "hidden", "true" );
            }
          }
          else
          {
            theHTMLBox.setAttribute( "hidden", "false" );
          }
        }
*/        
      }
      if ( ! theServiceTree.urlFromServicePane )
      {
        // Clear the service tree selection (asynchronously?  is this from out of thread?)
        setTimeout( 
                    "document.getElementById( 'frame_servicetree' ).tree.view.selection.currentIndex = -1;" +
                    "document.getElementById( 'frame_servicetree' ).tree.view.selection.clearSelection();",
                    50 );
      }
      theServiceTree.urlFromServicePane = false;
      
      thePaneLoadingData.setValue( true );
      
      // Clear the playlist tree variable so we are not confused.
      thePlaylistTree = null;
      theLibraryPlaylist = null;
      // hack, to let play buttons find the visible playlist if needed
      document.__CURRENTPLAYLIST__ = null;
      
      // Clear the tracking variable
      mainpane_listener_set = false;
      
      // Disable the "add to playlist" button until we see that there is anything to add.
      theCanAddToPlaylistData.setValue( false );
      onBrowserPlaylistHide();

      // Clear the playlist tree variable so we are not confused.
      thePlaylistTree = null;
      theLibraryPlaylist = null;
      // hack, to let play buttons find the visible playlist if needed
      document.__CURRENTPLAYLIST__ = null;
      
      // Nothing in the status text
      theStatusText.setValue( "" );
      
      theServiceTree.current_url = cur_uri;
    }
    catch ( err )
    {
      alert( "onLocationChange\n\n" + err );
    }
  }
}

// onBrowserBack
function onBrowserBack()
{
  // Disable the "add to playlist" button until we see that there is anything to add.
  theCanAddToPlaylistData.setValue( false );
  onBrowserPlaylistHide();
  var theMainPane = document.getElementById( "frame_main_pane" );
  mainpane_listener_set = false;
  theMainPane.goBack();
}

// onBrowserFwd
function onBrowserFwd()
{
  // Disable the "add to playlist" button until we see that there is anything to add.
  theCanAddToPlaylistData.setValue( false );
  onBrowserPlaylistHide();
  var theMainPane = document.getElementById( "frame_main_pane" );
  mainpane_listener_set = false;
  theMainPane.goForward();
}

// onBrowserRefresh
function onBrowserRefresh()
{
  try
  {
    var theMainPane = document.getElementById( "frame_main_pane" );
    mainpane_listener_set = false;
    theMainPane.reload();
  }
  catch( err )
  {
    alert( err );
  }
}

// onBrowserStop
function onBrowserStop()
{
  try
  {
    var theMainPane = document.getElementById( "frame_main_pane" );
    theMainPane.stop();
    mainpane_listener_set = false;
    onMainPaneLoad();
  }
  catch( err )
  {
    alert( err );
  }
}

// onBrowserHome
function onBrowserHome()
{
  var theServiceTree = document.getElementById( 'frame_servicetree' );
  theServiceTree.launchServiceURL( "http://songbirdnest.com/player/welcome/" );
}

// onBrowserBookmark
function onBrowserBookmark()
{
  try
  {
    alert( "Uh... there's no bookmarks service in XULRunner.  We'll implement this soon." );
/*  
    var url = SBDataGetValue( "browser.uri" );
    alert(url + "\n" + Components.interfaces.nsIBookmarksService);
    var bmarks = Components.classes["@mozilla.org/browser/bookmarks-service;1"].getService();
    bmarks.QueryInterface(Components.interfaces.nsIBookmarksService);
    bmarks.addBookmarkImmediately(url,url,0,null);
    alert(url);
*/    
  }  
  catch ( err )
  {
    alert( "onBrowserBookmark\n" + err );
  }
}

var SBWebPlaylistCommands = 
{
  m_Playlist: null,

  m_Ids: new Array
  (
    "library_cmd_play",
//    "library_cmd_edit",
    "library_cmd_download",
    "library_cmd_subscribe",
    "library_cmd_addtoplaylist",
    "library_cmd_addtolibrary",
    "*separator*",
    "library_cmd_showdlplaylist",
    "library_cmd_burntocd"
//    "library_cmd_device"
  ),
  
  m_Names: new Array
  (
    "&command.play",
//    "&command.edit",
    "&command.download",
    "&command.subscribe",
    "&command.addtoplaylist",
    "&command.addtolibrary",
    "*separator*",
    "&command.showdlplaylist",
    "&command.burntocd"
//    "&command.device"
  ),
  
  m_Tooltips: new Array
  (
    "&command.tooltip.play",
//    "&command.tooltip.edit",
    "&command.tooltip.download",
    "&command.tooltip.subscribe",
    "&command.tooltip.addtoplaylist",
    "&command.tooltip.addtolibrary",
    "*separator*",
    "&command.tooltip.showdlplaylist",
    "&command.tooltip.burntocd"
//    "&command.tooltip.device"
  ),

  GetNumCommands: function()
  {
    if ( 
        ( this.m_Tooltips.length != this.m_Ids.length ) ||
        ( this.m_Names.length != this.m_Ids.length ) ||
        ( this.m_Tooltips.length != this.m_Names.length )
        )
    {
      alert( "PlaylistCommands - Array lengths do not match!" );
      return 0;
    }
    return this.m_Ids.length;
  },

  GetCommandId: function( index )
  {
    if ( index >= this.m_Ids.length )
    {
      return "";
    }
    return this.m_Ids[ index ];
  },

  GetCommandText: function( index )
  {
    if ( index >= this.m_Names.length )
    {
      return "";
    }
    return this.m_Names[ index ];
  },

  GetCommandFlex: function( index )
  {
    if ( this.m_Ids[ index ] == "*separator*" ) return 1;
    return 0;
  },

  GetCommandToolTipText: function( index )
  {
    if ( index >= this.m_Tooltips.length )
    {
      return "";
    }
    return this.m_Tooltips[ index ];
  },

  GetCommandEnabled: function( index )
  {
    var retval = false;
    switch ( this.m_Ids[index] )
    {
      case "library_cmd_device":
        retval = false; // not yet implemented
      break;
      default:
        retval = true;
      break;
    }
    return retval;
  },

  OnCommand: function( event )
  {
    if ( event.target && event.target.id )
    {
      // Was it from the toolbarbutton?
      var tbb = ( event.target.tagName == "button" || event.target.tagName == "xul:button" );
      switch( event.target.id )
      {
        case "library_cmd_play":
          if ( this.m_Playlist.tree.currentIndex != -1 )
          {
            // Repurpose the command to act as if a doubleclick
            this.m_Playlist.sendPlayEvent();
          }
        break;
        case "library_cmd_edit":
          if ( this.m_Playlist.tree.currentIndex != -1 )
          {
            if ( tbb )
            {
              // Open the editor for the whole track
            }
            else
            {
              // Edit the context cell
              this.m_Playlist.sendEditEvent();
            }
          }
        break;
        case "library_cmd_download":
        {
          try
          {        
            var filterCol = "uuid";
            var filterVals = new Array();
            
            var columnObj = this.m_Playlist.tree.columns.getNamedColumn(filterCol);
            var rangeCount = this.m_Playlist.tree.view.selection.getRangeCount();
            for (var i=0; i < rangeCount; i++) 
            {
              var start = {};
              var end = {};
              this.m_Playlist.tree.view.selection.getRangeAt( i, start, end );
              for( var c = start.value; c <= end.value; c++ )
              {
                if (c >= this.m_Playlist.tree.view.rowCount) 
                {
//                  alert( c + ">=" + this.m_Playlist.tree.view.rowCount );
                  continue; 
                }
                
                var value = this.m_Playlist.tree.view.getCellText(c, columnObj);
                
                filterVals.push(value);
              }
            }

  /*
            for(var i in filterVals)
            {
              alert(filterVals[i]);
            }
  */
            
            onBrowserTransfer( this.m_Playlist.guid, this.m_Playlist.table, filterCol, filterVals.length, filterVals );
            // And show the download table in the chrome playlist.
            onBrowserDownload();
          }
          catch( err )          
          {
            alert( err );
          }
        }
        break;
        case "library_cmd_subscribe":
        {
          // Bring up the subscribe dialog with the web playlist url
          var url = this.m_Playlist.type;
          var readable_name = null;
          var guid = null;
          var table = null;
          if ( url == "http" )
          {
            url = this.m_Playlist.description;
            readable_name = this.m_Playlist.readable_name;
            guid = this.m_Playlist.guid;
            table = this.m_Playlist.table;
          }
          SBSubscribe( url, guid, table, readable_name );
        }
        break;
        case "library_cmd_addtoplaylist":
        {
          this.m_Playlist.addToPlaylist();
        }
        break;
        case "library_cmd_addtolibrary":
        {
          this.m_Playlist.addToLibrary();
        }
        break;
        case "library_cmd_showdlplaylist":
        {
          onBrowserDownload();
        }
        break;
      }
    }
  },
  
  // The object registered with the sbIPlaylistSource interface acts 
  // as a template for instances bound to specific playlist elements
  Duplicate: function()
  {
    var obj = {};
    for ( var i in this )
    {
      obj[ i ] = this[ i ];
    }
    return obj;
  },
  
  SetPlaylist: function( playlist )
  {
    this.m_Playlist = playlist;
  },
  
  QueryInterface : function(aIID)
  {
    if (!aIID.equals(Components.interfaces.sbIPlaylistCommands) &&
        !aIID.equals(Components.interfaces.nsISupportsWeakReference) &&
        !aIID.equals(Components.interfaces.nsISupports)) 
    {
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    
    return this;
  }
}

// Register the web playlist commands at startup
if ( ( WEB_PLAYLIST_CONTEXT != "" ) && ( WEB_PLAYLIST_TABLE != "" ) )
{
  var source = new sbIPlaylistsource();
  source.RegisterPlaylistCommands( WEB_PLAYLIST_CONTEXT, WEB_PLAYLIST_TABLE, "http", SBWebPlaylistCommands );
}

function onBrowserPlaylist()
{
  metrics_inc("player", "urlslurp", null);
  if ( ! thePlaylistTree )
  {
    if (!theWebPlaylist.source ||
        theWebPlaylist.source.GetRefGUID(theWebPlaylist.ref) != WEB_PLAYLIST_CONTEXT ||
        theWebPlaylist.source.GetRefTable(theWebPlaylist.ref) != WEB_PLAYLIST_TABLE)
    {
      SBWebPlaylistCommands.m_Playlist = theWebPlaylist;
      theWebPlaylist.bind( WEB_PLAYLIST_CONTEXT, WEB_PLAYLIST_TABLE, null, SBWebPlaylistCommands, SBDataGetValue( "browser.playlist.height" ), SBDataGetValue( "browser.playlist.collapsed" ) );
    }
    
    // Show/hide them
    theShowWebPlaylistData.setValue( true );
  }
  else
  {
    var theServiceTree = document.getElementById( 'frame_servicetree' );
    theServiceTree.launchServiceURL( "chrome://songbird/content/xul/main_pane.xul?" + WEB_PLAYLIST_TABLE + "," + WEB_PLAYLIST_CONTEXT );
  }
}

function onBrowserPlaylistResize()
{
  SBDataSetValue( "browser.playlist.height", theWebPlaylist.height );
  var collapsed = theWebPlaylist.previousSibling.getAttribute( "state" ) == "collapsed";
  if (collapsed && SBDataGetIntValue("browser.playlist.collapsed") == 0) metrics_inc("player", "collapse.webplaylist", null);
  SBDataSetValue( "browser.playlist.collapsed", collapsed );
}

function onBrowserDownload()
{
  metrics_inc("player", "downloads", null);

  // Work to figure out guid and table
  var guid = theDownloadContext.getValue();
  var table = theDownloadTable.getValue();
  var aDeviceManager = Components.classes["@songbird.org/Songbird/DeviceManager;1"].
                                  getService(Components.interfaces.sbIDeviceManager);
  if (aDeviceManager)
  {
    var aDownloadDevice = null;
    try {
      aDownloadDevice = aDeviceManager.getDeviceByString('Songbird Download Device');
    }
    catch (e) {}
    
    if (aDownloadDevice)
    {
      SBDownloadCommands.m_Device = aDownloadDevice;
      guid = aDownloadDevice.GetContext('');
      table = "download"; // aDownloadDevice.GetTransferTableName('');
    }
  }
  
  // Actual functionality
  if ( ! thePlaylistTree )
  {
    // Errrr, nope?
    if ( ( guid == "" ) || ( table == "" ) )
    {
      return;
    }

    if (!theWebPlaylist.source ||
        theWebPlaylist.source.GetRefGUID(theWebPlaylist.ref) != guid ||
        theWebPlaylist.source.GetRefTable(theWebPlaylist.ref) != table)
    {
      theWebPlaylist.bind( guid, table, null, SBDownloadCommands, SBDataGetValue( "browser.playlist.height" ), SBDataGetValue( "browser.playlist.collapsed" ) );
    }
    
    // Show/hide them
    theShowWebPlaylistData.setValue( true );
  }
  else
  {
    var theServiceTree = document.getElementById( 'frame_servicetree' );
    theServiceTree.launchServiceURL( "chrome://songbird/content/xul/main_pane.xul?" + table + "," + guid );
  }
}

function onBrowserPlaylistHide()
{
  // Hide the web table if it exists
  theShowWebPlaylistData.setValue( false );
 
  // Can't we just use the "theWebPlaylist" global variable? -redfive 
  // And unhook the playlist from the database
  var theTree = document.getElementById( "playlist_web" );
  if ( theTree )
  {
    var source = new sbIPlaylistsource();
    source.ClearPlaylist( theTree.ref );  // this call is deprecated 
    theTree.datasources = "";
    theTree.ref = "";
  }
}

// onHTMLUrlChange
function onHTMLUrlChange( evt )
{
  var value = evt.target.value;
  if ( value && value.length )
  {
    // Make sure the value is an url
    value = SBGetUrlFromService( value );
    // And then put it back in the box as a service
    theBrowserUriData.setValue( value );
    theBrowserUrlData.setValue( SBGetServiceFromUrl( value ) );
    var image = SBGetServiceImageFromUrl( value );
//    if ( image.length )
    {
      theBrowserImageData.setValue( image );
    }
    // And then go to the url.  Easy, no?
    var theServiceTree = document.getElementById( 'frame_servicetree' );
    theServiceTree.launchURL( value );
  }
}

function onHTMLURLFocus (evt) 
{
  var url = document.getElementById("browser_url");
  var text = url.value;
  url.selectionStart = 0;
  url.selectionEnd = text.length;
}

function onHTMLUrlKeypress( evt )
{
  switch ( evt.keyCode )
  {
    case 13: // Enter
      evt.target.value = SBTabcompleteService( evt.target.value );
      onHTMLUrlChange( evt );
      evt.target.selectionStart = 0;
      evt.target.selectionEnd = evt.target.value.length;
      break;
          
/*      
    case 9:  // Tab
      var value = SBTabcompleteService( evt.target.value );
      if ( value != evt.target.value )
      {
        alert ( value + " != " + evt.target.value )
        evt.target.value = value;
        onHTMLUrlChange( evt );
      }
      break;
*/      
  }
}

var mainpane_listener_set = false;
var thePlaylistRef = new sbIDataRemote( "playlist.ref" );
var thePaneLoadingData = new sbIDataRemote( "faceplate.loading" );
thePaneLoadingData.setValue( false );
var thePlaylistTree;

var theCurrentMainPaneDocument = null;
function onMainPaneLoad()
{
  try
  {
    if ( ! mainpane_listener_set )
    {
      var theMainPane = document.getElementById( "frame_main_pane" );
      if ( typeof( theMainPane ) == 'undefined' )
      {
        return;
      }
      
      //
      //
      // HORRIBLE SECURITY HACK TO GET THE PLAYLIST TREE AND INJECT FUN EVENT HANDLERS 
      //
      //
      var installed_listener = false;
      var main_iframe = theMainPane.contentDocument.getElementById( "main_iframe" );
      if ( main_iframe )
      {
        if ( main_iframe.wrappedJSObject )
          main_iframe = main_iframe.wrappedJSObject;
        // Doublecheck that the playlist piece loaded properly?
        if ( ( ! main_iframe.contentDocument ) || ( ! main_iframe.contentDocument.getElementById ) )
        {
          // Try again in 250 ms?
          setTimeout( onMainPaneLoad, 250 );
          return;
        }
        
        thePlaylistTree = main_iframe.contentDocument.getElementById( "playlist_test" );
        if ( thePlaylistTree )
        {
          // Crack the security if necessary
          if ( thePlaylistTree.wrappedJSObject )
            thePlaylistTree = thePlaylistTree.wrappedJSObject;
            
          // Wait until after the bind call?
          if ( thePlaylistTree.ref == "" )
          {
            // Try again in 250 ms?
            setTimeout( onMainPaneLoad, 250 );
            return;
          }

          // hack, to let play buttons find the visible playlist if needed
          document.__CURRENTPLAYLIST__ = thePlaylistTree;

          // Drag and Drop tracker object
          thePlaylistTree.setDnDSourceTracker(sbDnDSourceTracker);

          // Events on the playlist object itself.            
          thePlaylistTree.addEventListener( "playlist-edit", onPlaylistEdit, true );
          thePlaylistTree.addEventListener( "playlist-play", onPlaylistPlay, true );
          thePlaylistTree.addEventListener( "playlist-burntocd", onPlaylistBurnToCD, true );
          thePlaylistTree.addEventListener( "command", onPlaylistContextMenu, false );  // don't force it!
            
          // Remember some values
          theLibraryPlaylist = thePlaylistTree;
          thePlaylistTree = thePlaylistTree.tree;
          thePlaylistRef.setValue( thePlaylistTree.getAttribute( "ref" ) ); // is this set yet?
          
          // Set the current selection
          theLibraryPlaylist.syncPlaylistIndex(false);
          
          // And remember that we did this
          installed_listener = true;
          
          // Hide the progress bar now that we're loaded.
          thePaneLoadingData.setValue( false );
          mainpane_listener_set = true;
        }
      }
      else
      {
        thePlaylistTree = null;
        theLibraryPlaylist = null;
        // hack, to let play buttons find the visible playlist if needed
        document.__CURRENTPLAYLIST__ = null;
      }

      // If we don't install a playlist listener, install an url listener.
      if ( ! installed_listener )
      {

        if ( theMainPane.contentDocument && theMainPane.contentDocument.getElementsByTagName('A').length == 0 )
        {
          setTimeout( onMainPaneLoad, 2500 );
          return;
        }
          
        AsyncWebDocument( theMainPane.contentDocument );
        
        // Hide the progress bar now that we're loaded.
        thePaneLoadingData.setValue( false );
        mainpane_listener_set = true;
      }
    }
  }
  catch( err )
  {
    alert( err );
  }
}

function onMainPaneUnload()
{
  try
  {
  }
  catch( err )
  {
    alert( err );
  }
}

function IsMediaUrl( the_url )
{
  if ( ( the_url.indexOf ) && 
        (
          // Protocols at the beginning
          ( the_url.indexOf( "mms:" ) == 0 ) || 
          ( the_url.indexOf( "rtsp:" ) == 0 ) || 
          // File extensions at the end
          ( the_url.indexOf( ".pls" ) != -1 ) || 
          ( the_url.indexOf( "rss" ) != -1 ) || 
          ( the_url.indexOf( ".m3u" ) == ( the_url.length - 4 ) ) || 
//          ( the_url.indexOf( ".rm" ) == ( the_url.length - 3 ) ) || 
//          ( the_url.indexOf( ".ram" ) == ( the_url.length - 4 ) ) || 
//          ( the_url.indexOf( ".smil" ) == ( the_url.length - 5 ) ) || 
          ( the_url.indexOf( ".mp3" ) == ( the_url.length - 4 ) ) ||
          ( the_url.indexOf( ".ogg" ) == ( the_url.length - 4 ) ) ||
          ( the_url.indexOf( ".flac" ) == ( the_url.length - 5 ) ) ||
          ( the_url.indexOf( ".wav" ) == ( the_url.length - 4 ) ) ||
          ( the_url.indexOf( ".m4a" ) == ( the_url.length - 4 ) ) ||
          ( the_url.indexOf( ".wma" ) == ( the_url.length - 4 ) ) ||
          ( the_url.indexOf( ".wmv" ) == ( the_url.length - 4 ) ) ||
          ( the_url.indexOf( ".asx" ) == ( the_url.length - 4 ) ) ||
          ( the_url.indexOf( ".asf" ) == ( the_url.length - 4 ) ) ||
          ( the_url.indexOf( ".avi" ) == ( the_url.length - 4 ) ) ||
          ( the_url.indexOf( ".mov" ) == ( the_url.length - 4 ) ) ||
          ( the_url.indexOf( ".mpg" ) == ( the_url.length - 4 ) ) ||
          ( the_url.indexOf( ".mp4" ) == ( the_url.length - 4 ) )
        )
      )
  {
    return true;
  }
  return false;
}

function IsPlaylistUrl( the_url )
{
  try
  {
    if ( the_url.indexOf )
    {
      // Make the playlist reader manager.
      const PlaylistReaderManager = new Components.Constructor("@songbird.org/Songbird/PlaylistReaderManager;1", "sbIPlaylistReaderManager");
      var aPlaylistReaderManager = (new PlaylistReaderManager()).QueryInterface(Components.interfaces.sbIPlaylistReaderManager);
      
      // Tell it what filters to be using
      var filterlist = "";
      var extensionCount = new Object;
      var extensions = aPlaylistReaderManager.SupportedFileExtensions(extensionCount);

      for(var i = 0; i < extensions.length; i++)
      {
        if ( the_url.indexOf( "." + extensions[i] ) != -1 )
        {      
          return true;
        }
      }
    }
  }
  catch ( err )
  {
    alert( "IsPlaylistUrl - " + err );
  }
  return false;
}

function GetHrefFromEvent( evt )
{
  var the_href = "";
  try
  {
    var node = evt.target;
    while ( node ) // Walk up from the event target to find the A? 
    {
      if ( node.href )
      {
        the_href = node.href;
        break;
      }
      node = node.parentNode;
    }
  }
  catch ( err )
  {
    alert( err );
  }
  return the_href;
}

// Catch a contextual on a media url and attempt to play it
function onLinkOver( evt )
{
  var the_url = GetHrefFromEvent( evt )
  theStatusText.setValue( the_url );
  if ( IsMediaUrl( the_url ) )
  {
    theStatusStyle.setValue( "font-weight: bold;" );
  }
  else
  {
    theStatusStyle.setValue( "font-weight: normal;" );
  }
}

// Catch a contextual on a media url and attempt to play it
function onLinkOut( evt )
{
  theStatusText.setValue( "" );
}

// Catch a contextual on a media url and attempt to play it
var theHTMLContextURL = null;
function onLinkContext( evt )
{
  try
  {
    var theMainPane = document.getElementById( "frame_main_pane" );
    var theHTMLPopup = document.getElementById( "html_context_menu" );
    theHTMLContextURL = GetHrefFromEvent( evt );
    
    var theAddItem = document.getElementById( "html.context.add" );
    var disabled = "true";
    if ( IsMediaUrl( theHTMLContextURL ) && ! SBUrlExistsInDatabase( theHTMLContextURL ) )
    {
      disabled = "false"
    }
    theAddItem.setAttribute( "disabled", disabled );
    
    theHTMLPopup.showPopup( theMainPane, theMainPane.boxObject.screenX + evt.clientX, theMainPane.boxObject.screenY + evt.clientY, "context", null, null );
  }
  catch ( err )
  {
    alert( err );
  }
}

function playExternalUrl(the_url, tryweb) 
{
  var PPS = Components.classes["@songbird.org/Songbird/PlaylistPlayback;1"].getService(Components.interfaces.sbIPlaylistPlayback);
  // figure out if the url is in the webplaylist
  if (tryweb && theWebPlaylist) 
  {
    var row = theWebPlaylist.findRowIdByUrl(the_url);
    if (row != -1) 
    {
      // if so, play the ref, from that entry's index
      PPS.playRef("NC:webplaylist_webplaylist", row);
    }
  } else {
    // otherwise, play the url as external (added to the db, plays the library from that point on)
    PPS.playAndImportUrl(the_url); // if the url is already in the lib, it is not added twice
  }
}

// Catch a click on a media url and attempt to play it
function onMediaClick( evt )
{
  try
  {
    var the_url = GetHrefFromEvent( evt );
    if ( IsMediaUrl( the_url ) )
    {
      playExternalUrl(the_url, true);
      evt.stopPropagation();
      evt.preventDefault();
    }
  }
  catch ( err )
  {
    alert( err );
  }
}

function onPlaylistKeypress( evt )
{
  switch ( evt.keyCode )
  {
    case 13: // Return
      SBPlayPlaylistIndex( thePlaylistTree.currentIndex );
      break;
  }
}

// Yo, play something, bitch.
function onPlaylistPlay( evt )
{
  var target = evt.target;
  if ( target.wrappedJSObject )
  {
    target = target.wrappedJSObject;
  }
  SBPlayPlaylistIndex( target.tree.currentIndex, target );
}

function onPlaylistBurnToCD( evt )
{
  var target = evt.target;
  if ( target.wrappedJSObject )
  {
    target = target.wrappedJSObject;
  }
  
  playlist = target;
  playlistTree = target.tree;
  
	var filterCol = "uuid";
	var filterVals = new Array();

	var columnObj = playlistTree.columns.getNamedColumn(filterCol);
	var rangeCount = playlistTree.view.selection.getRangeCount();
	for (var i=0; i < rangeCount; i++) 
	{
		var start = {};
		var end = {};
		playlistTree.view.selection.getRangeAt( i, start, end );
		for( var c = start.value; c <= end.value; c++ )
		{
			if (c >= playlistTree.view.rowCount) 
			{
			continue; 
			}
	        
			var value = playlistTree.view.getCellText(c, columnObj);
			filterVals.push(value);
		}
	}
	
    onAddToCDBurn( playlist.guid, playlist.table, filterCol, filterVals.length, filterVals );
}

function onPlaylistDblClick( evt )
{
  if ( typeof( thePlaylistTree ) == 'undefined' )
  {
    alert( "DOM?" );
    return;
  }
  var obj = {}, row = {}, col = {}; 
  thePlaylistTree.treeBoxObject.getCellAt( evt.clientX, evt.clientY, row, col, obj );
  // If the "obj" has a value, it is a cell?
  if ( obj.value )
  {
    if ( thePlaylistTree.currentIndex != -1 )
    {
      SBPlayPlaylistIndex( thePlaylistTree.currentIndex );
    }
  }
}

function SBDownloadDeviceTest()
{
try
{
  var aDownloadDevice = Components.classes["@songbird.org/Songbird/DownloadDevice;1"];
  if (aDownloadDevice)
  {
    aDownloadDevice = aDownloadDevice.createInstance();
    aDownloadDevice = aDownloadDevice.QueryInterface(Components.interfaces.sbIDeviceBase);
    
    if (aDownloadDevice)
    {
      listProperties( aDownloadDevice, "aDownloadDevice" );
      alert( Components.interfaces.sbIDownloadDevice );
          aDownloadDevice.name;
          aDownloadDevice.IsDownloadSupported();
          t = aDownloadDevice.DownloadTrackTable('testdb-0000','download');
    }
  }
}
catch ( err )  
{
  alert( err );
}
}

var theCurrentlyEditingPlaylist = null;
function onPlaylistEdit( evt )
{
  try
  {
    var playlist = evt.target;
    if ( playlist.wrappedJSObject )
      playlist = playlist.wrappedJSObject;
    
    // Make sure it's something with a uuid column.
    var filter = "uuid";
    var filter_column = playlist.tree.columns ? playlist.tree.columns[filter] : filter;
    var filter_value = playlist.tree.view.getCellText( playlist.tree.currentIndex, filter_column );
    if ( !filter_value )
    {
      return;
    }
    
    // We want to resize the edit box to the size of the cell.
    var out_x = {}, out_y = {}, out_w = {}, out_h = {}; 
    playlist.tree.treeBoxObject.getCoordsForCellItem( playlist.edit_row, playlist.edit_col, "cell",
                                                        out_x , out_y , out_w , out_h );
                           
    var cell_text = playlist.tree.view.getCellText( playlist.edit_row, playlist.edit_col );
    
    // Then pop the edit box to the bounds of the cell.
    var theMainPane = document.getElementById( "frame_main_pane" );
    var theEditPopup = document.getElementById( "playlist_edit_popup" );
    var theEditBox = document.getElementById( "playlist_edit" );
    var extra_x = 4; // Why do I have to give it extra?  What am I calculating wrong?
    var extra_y = 21; // Why do I have to give it extra?  What am I calculating wrong?
    var less_w  = 5;
    var less_h  = 0;
    var pos_x = extra_x + playlist.tree.boxObject.screenX + out_x.value;
    var pos_y = extra_y + playlist.tree.boxObject.screenY + out_y.value;
    theEditBox.setAttribute( "hidden", "false" );
    theEditPopup.showPopup( theMainPane, pos_x, pos_y, "context" );
    theEditPopup.sizeTo( out_w.value - less_w, out_h.value - less_h ); // increase the width to the size of the cell.
    theEditBox.value = cell_text;
    theEditBox.focus();
    theEditBox.select();
    isPlaylistEditShowing = true;
    theCurrentlyEditingPlaylist = playlist;
  }
  catch ( err )
  {
    alert( err );
  }
}

function onPlaylistEditChange( evt )
{
  try
  {
    var theEditBox = document.getElementById( "playlist_edit" );
    
    // Find the url column.
    var filter = "uuid";
    var filter_column = theCurrentlyEditingPlaylist.tree.columns ? theCurrentlyEditingPlaylist.tree.columns[filter] : filter;
    var filter_value = theCurrentlyEditingPlaylist.tree.view.getCellText( theCurrentlyEditingPlaylist.tree.currentIndex, filter_column );
    
    var the_table_column = theCurrentlyEditingPlaylist.edit_col.id;
    var the_new_value = theEditBox.value
    
    var aDBQuery = Components.classes["@songbird.org/Songbird/DatabaseQuery;1"].createInstance(Components.interfaces.sbIDatabaseQuery);
    var aMediaLibrary = Components.classes["@songbird.org/Songbird/MediaLibrary;1"].createInstance(Components.interfaces.sbIMediaLibrary);
    
    if ( ! aDBQuery || ! aMediaLibrary)
      return;
    
    aDBQuery.SetAsyncQuery(true);
    aDBQuery.SetDatabaseGUID(theCurrentlyEditingPlaylist.guid);
    aMediaLibrary.SetQueryObject(aDBQuery);
    
    aMediaLibrary.SetValueByGUID(filter_value, the_table_column, the_new_value, false);
    
    //var table = "library" // hmm... // theCurrentlyEditingPlaylist.table;
    //var q = 'update ' + table + ' set ' + the_table_column + '="' + the_new_value + '" where ' + filter + '="' + filter_value + '"';
    //aDBQuery.AddQuery( q );
    
    //var ret = aDBQuery.Execute();
    
    HidePlaylistEdit();
  }
  catch ( err )
  {
    alert( err );
  }
}

function onPlaylistEditKeypress( evt )
{
  switch ( evt.keyCode )
  {
    case 27: // Esc
      HidePlaylistEdit();
      break;
    case 13: // Return
      onPlaylistEditChange( evt );
      break;
  }
}

function onMainwinKeypress( evt )
{
  switch ( evt.charCode )
  {
    case 102: // Ctrl-F
      if ( evt.ctrlKey )
      {
        var search_widget = document.getElementById( "search_widget" );
        search_widget.onFirstMousedown(); // Sets focus.  Clears "search" text.
      }
      break;
    case 101:
      if (evt.ctrlKey) 
      {
        // for now only allow editing the main db
        if (theLibraryPlaylist && theLibraryPlaylist.guid == "songbird") SBTrackEditorOpen();
      }
      break;
    case 108: // Ctrl-L
      if ( evt.ctrlKey )
      {
        var location_bar = document.getElementById( "browser_url" );
        location_bar.focus();
      }
      break;
  }
}

var isPlaylistEditShowing = false;
function HidePlaylistEdit()
{
  try
  {
    if ( isPlaylistEditShowing )
    {
      var theEditBox = document.getElementById( "playlist_edit" );
      theEditBox.setAttribute( "hidden", "true" );
      var theEditPopup = document.getElementById( "playlist_edit_popup" );
      theEditPopup.hidePopup();
      isPlaylistEditShowing = false;        
      theCurrentlyEditingPlaylist = null;
    }
  }
  catch ( err )
  {
    alert( err );
  }
}

// Menubar handling
function onPlaylistContextMenu( evt )
{
  try
  {
    // hacky for now
    var playlist = theLibraryPlaylist;
    if ( !playlist )
    {
      playlist = theWebPlaylist;
    }
    
    // All we do up here, now, is dispatch the search items
    onSearchTerm( playlist.context_item, playlist.context_term );
  }
  catch ( err )
  {
    alert( err );
  }
}

function onSearchTerm( target, in_term )
{
  var search_url = "";
  if ( in_term && in_term.length )
  {
//    var term = '"' + in_term + '"';
    var term = in_term;
    var v = target.getAttribute( "id" );
    switch ( v )
    {
      case "search.popup.songbird":
        onSearchEditIdle();
      break;
      case "search.popup.google":
        search_url = "http://www.google.com/musicsearch?q=" + term + "&sa=Search";
      break;
      case "search.popup.wiki":
        search_url = "http://en.wikipedia.org/wiki/Special:Search?search=" + term;
      break;
      case "search.popup.yahoo":
        search_url = "http://audio.search.yahoo.com/search/audio?ei=UTF-8&fr=sfp&p=" + term;
      break;
      case "search.popup.emusic":
        search_url = "http://www.emusic.com/search.html?mode=x&QT=" + term + "&x=0&y=0";
      break;
      case "search.popup.insound":
        search_url = "http://search.insound.com/search/searchmain.jsp?searchby=meta&query=" + term + "&fromindex=1&submit.x=0&submit.y=0";
      break;
      case "search.popup.odeo":
        search_url = "http://odeo.com/search/query/?q=" + term + "&Search.x=0&Search.y=0";
      break;
      case "search.popup.shoutcast":
        search_url = "http://www.shoutcast.com/directory/?s=" + term;
      break;
      case "search.popup.radiotime":
        search_url = "http://radiotime.com/toppicks.aspx?p=0&st=0&t=" + term;
      break;
      case "lyrics.popup.google":
        search_url = "http://www.google.com/search?q=lyrics " + term + "&sa=Search&client=pub-4053348708517670&forid=1&ie=ISO-8859-1&oe=ISO-8859-1&hl=en&GALT:#333333;GL:1;DIV:#37352E;VLC:000000;AH:center;BGC:C6B396;LBGC:8E866F;ALC:000000;LC:000000;T:44423A;GFNT:663333;GIMP:663333;FORID:1;";
      break;
    }
  }
  if ( search_url.length )
  {
    var theServiceTree = document.getElementById( 'frame_servicetree' );
    theServiceTree.launchURL( search_url );
  }
}

var repeat = new sbIDataRemote( "playlist.repeat" ); 

// Menubar handling
function onMenu( target )
{
  var v = target.getAttribute( "id" );
  switch ( v )
  {
    case "file.new":
      SBNewPlaylist();
    break;
    case "file.smart":
      SBNewSmartPlaylist();
    break;
    case "file.remote":
      SBSubscribe( "", "", "", "" );
    break;
    case "file.file":
      SBFileOpen();
    break;
    case "file.url":
      SBUrlOpen();
    break;
    case "file.mab":
      SBMabOpen();
    break;
    case "file.playlist":
      SBPlaylistOpen();
    break;
    case "file.scan":
      SBScanMedia();
    break;
    case "file.dlfolder":
      SBSetDownloadFolder();
    break;
    case "file.watch":
      SBWatchFolders();
    break;
/*    
    case "file.htmlbar":
      if ( SBDataGetIntValue( "option.htmlbar" ) == 0 )
      {
        SBDataSetValue( "option.htmlbar", 1 );
      }
      else
      {
        SBDataSetValue( "option.htmlbar", 0 );
      }
    break;
*/    

    case "file.window":
      SBMiniplayerOpen();
    break;
    case "file.koshi":
      SBKoshiOpen();
    break;
    case "file.about":
      About(); 
    break;
    case "file.exit":
      quitApp();
    break;
    case "control.play":
      if ( ! gPPS.getPlaying() )
      {
        onPlay();
      }
      else
      {
        onPause();
      }
    break;
    case "control.next":
      onFwd();
    break;
    case "control.prev":
      onBack();
    break;
    case "control.shuf":
      onShuffle();
    break;
    case "control.repa":
      repeat.setValue( 2 );
    break;
    case "control.rep1":
      repeat.setValue( 1 );
    break;
    case "control.repx":
      repeat.setValue( 0 );
    break;
    case "menu.extensions":
      SBExtensionsManagerOpen();
    break;
    case "menu.preferences":
      SBOpenPreferences();
    break;
/*    case "menu.downloadmgr":
      SBOpenDownloadManager();
    break;*/
    case "menu.dominspector":
      SBDOMInspectorOpen();
    break;
    
    default:
      if ( target.value )
      {
        var theServiceTree = document.getElementById( 'frame_servicetree' );
        theServiceTree.launchURL( target.value );
      }
    break;
  }
}

function SBOpenPreferences(paneID)
{
  var features = "chrome,titlebar,toolbar,centerscreen,modal";

  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
  var win = wm.getMostRecentWindow("Browser:Preferences");
  if (win) {
    win.focus();
    if (paneID) {
      var pane = win.document.getElementById(paneID);
      win.document.documentElement.showPane(pane);
    }
  }
  else
    openDialog("chrome://browser/content/preferences/preferences.xul", "Preferences", features, paneID);
    
  // to open connection settings only:
  // SBOpenModalDialog("chrome://browser/content/preferences/connection.xul", "chrome,modal=yes,centerscreen", null);
}

function SBSetDownloadFolder()
{
  // Just open the window, we don't care what the user does in it.
  SBOpenModalDialog( "chrome://songbird/content/xul/download.xul", "", "chrome,modal=yes,centerscreen", null );
}

/*function SBOpenDownloadManager()
{
  var dlmgr = Components.classes['@mozilla.org/download-manager;1'].getService();
  dlmgr = dlmgr.QueryInterface(Components.interfaces.nsIDownloadManager);

  var windowMediator = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService();
  windowMediator = windowMediator.QueryInterface(Components.interfaces.nsIWindowMediator);

  var dlmgrWindow = windowMediator.getMostRecentWindow("Download:Manager");
  if (dlmgrWindow) {
    dlmgrWindow.focus();
  }
  else {
    openDialog("chrome://mozapps/content/downloads/downloads.xul", "Download:Manager", "chrome,centerscreen", null);
   }
}*/

function SBWatchFolders()
{
  SBOpenModalDialog( "chrome://songbird/content/xul/watch_folders.xul", "", "chrome,modal=yes,centerscreen", null );
}

// Menubar handling
function onHTMLContextMenu( target )
{
  if ( theHTMLContextURL )
  {
    var v = target.getAttribute( "id" );
    switch ( v )
    {
      case "html.context.open":
        if ( IsMediaUrl( theHTMLContextURL ) )
        {
          playExternalUrl(theHTMLContextURL, true);
        }
        else
        {
          var theServiceTree = document.getElementById( 'frame_servicetree' );
          theServiceTree.launchURL( theHTMLContextURL );
        }
      break;
      case "html.context.play":
        playExternalUrl(theHTMLContextURL, true);
      break;
      case "html.context.add":
        var PPS = Components.classes["@songbird.org/Songbird/PlaylistPlayback;1"].getService(Components.interfaces.sbIPlaylistPlayback);
        PPS.importUrl(theHTMLContextURL);
      break;
      case "html.context.playlist":
        SBScanServiceTreeNewEntryEditable();
        var success = thePlaylistReader.AutoLoad(theHTMLContextURL, "songbird", ConvertUrlToDisplayName( theHTMLContextURL ), "http", theHTMLContextURL, "", null);
        SBScanServiceTreeNewEntryStart();
      break;
    }
    theHTMLContextURL = null; // clear it because now we're done.
  }
}


var theMediaScanIsOpen = new sbIDataRemote( "media_scan.open" );
function SBScanMedia( )
{
  theMediaScanIsOpen.setValue( true );
  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  const CONTRACTID_FILE_PICKER = "@mozilla.org/filepicker;1";
  var fp = Components.classes[CONTRACTID_FILE_PICKER].createInstance(nsIFilePicker);
  var welcome = "Welcome";
  var scan = "Scan";
  try
  {
    welcome = theSongbirdStrings.getString("faceplate.welcome");
    scan = theSongbirdStrings.getString("faceplate.scan");
  } catch(e) {}
  fp.init( window, welcome + "!\n\n" + scan, nsIFilePicker.modeGetFolder );
  var res = fp.show();
  if ( res == nsIFilePicker.returnOK )
  {
    var media_scan_data = new Object();
    media_scan_data.URL = fp.file.path;
    media_scan_data.retval = "";
    // Open the non-modal dialog
    SBOpenModalDialog( "chrome://songbird/content/xul/media_scan.xul", "media_scan", "chrome,modal=yes,centerscreen", media_scan_data );
  }
  theMediaScanIsOpen.setValue( false  );
}

function SBMabOpen()
{
  var mab_data = new Object();
  mab_data.retval = "";
  
  // Open the modal dialog
  SBOpenModalDialog( "chrome://songbird/content/xul/mab.xul", "Mozilla Amazon Browser", "chrome,modal=no", mab_data );
}

function SBNewPlaylist()
{
  try
  {
    SBScanServiceTreeNewEntryEditable();
    var query = new sbIDatabaseQuery();
    query.SetDatabaseGUID( "songbird" );
    var playlistmanager = new sbIPlaylistManager();
    var aUUIDGenerator = Components.classes["@mozilla.org/uuid-generator;1"].createInstance(Components.interfaces.nsIUUIDGenerator);
    var playlistguid = aUUIDGenerator.generateUUID();
    var playlist = playlistmanager.CreatePlaylist( playlistguid, name, "Playlist", "user", query );
    SBScanServiceTreeNewEntryStart();
  }
  catch ( err )
  {
    alert( "SBNewPlaylist - " + err );
  }
}

function SBMiniplayerOpen()
{
  // Open the window
  window.open( "chrome://songbird/content/xul/miniplayer.xul", "", "chrome,modal=no,popup=yes" );
  onExit();
}

function SBNewSmartPlaylist( guid, table )
{
  SBScanServiceTreeNewEntryEditable(); // Do this right before you add to the servicelist?
  
  // Make a magic data object to get passed to the dialog
  var smart_playlist = new Object();
  smart_playlist.retval = "";
  smart_playlist.guid = guid;
  smart_playlist.table = table
  // Open the window
  SBOpenModalDialog( "chrome://songbird/content/xul/smart_playlist.xul", "", "chrome,modal=yes,centerscreen", smart_playlist );
  
  if ( smart_playlist.retval == "ok" )
  {
    SBScanServiceTreeNewEntryStart(); // And this once you know you really did?
  }
}

function SBKoshiOpen()
{
  // Make a magic data object to get passed to the dialog
  var koshi_data = new Object();
  koshi_data.retval = "";
  // Open the window
  SBOpenModalDialog( "chrome://songbird/content/xul/koshi_test.xul", "", "chrome,modal=yes,centerscreen", koshi_data );
}

function SBExtensionsManagerOpen()
{
  const EMTYPE = "Extension:Manager";
  
  var aOpenMode = 'extensions';

  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);
  var needToOpen = true;
  var windowType = EMTYPE + "-" + aOpenMode;
  var windows = wm.getEnumerator(windowType);
  while (windows.hasMoreElements()) {
    var theEM = windows.getNext().QueryInterface(Components.interfaces.nsIDOMWindowInternal);
    if (theEM.document.documentElement.getAttribute("windowtype") == windowType) {
      theEM.focus();
      needToOpen = false;
      break;
    }
  }

  if (needToOpen) {
    const EMURL = "chrome://mozapps/content/extensions/extensions.xul?type=" + aOpenMode;
    const EMFEATURES = "chrome,dialog=no,resizable";
    window.openDialog(EMURL, "", EMFEATURES);
  }
}

function SBTrackEditorOpen()
{
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);
  var needToOpen = true;
  var windows = wm.getEnumerator("track_editor");
  while (windows.hasMoreElements()) {
    var theTE = windows.getNext().QueryInterface(Components.interfaces.nsIDOMWindowInternal);
    theTE.focus();
    needToOpen = false;
    break;
  }

  if (needToOpen) {
    const TEURL = "chrome://songbird/content/xul/trackeditor.xul";
    const TEFEATURES = "chrome,dialog=no,resizable";
    window.openDialog(TEURL, "track_editor", TEFEATURES, document);
  }
}

function SBDOMInspectorOpen()
{
  window.open("chrome://inspector/content/", "", "chrome,dialog=no,resizable");
}

function SBSubscribe( url, guid, table, readable_name )
{
  // Make a magic data object to get passed to the dialog
  var subscribe_data = new Object();
  subscribe_data.retval = "";
  subscribe_data.url = url;
  subscribe_data.readable_name = readable_name;
  // Open the window
  SBScanServiceTreeNewEntryEditable();
  SBOpenModalDialog( "chrome://songbird/content/xul/subscribe.xul", "", "chrome,modal=yes,centerscreen", subscribe_data );
  if ( subscribe_data.retval == "ok" )
  {
    if ( guid && table )
    {
      const PlaylistManager = new Components.Constructor("@songbird.org/Songbird/PlaylistManager;1", "sbIPlaylistManager");
      var aPlaylistManager = new PlaylistManager();
      aPlaylistManager = aPlaylistManager.QueryInterface(Components.interfaces.sbIPlaylistManager);
      var aDBQuery = new sbIDatabaseQuery();
      aDBQuery.SetAsyncQuery(false);
      aDBQuery.SetDatabaseGUID(guid);
      aPlaylistManager.DeletePlaylist( table, aDBQuery );
    }

    SBScanServiceTreeNewEntryStart();
  }
}

function About( )
{
  // Make a magic data object to get passed to the dialog
  var about_data = new Object();
  about_data.retval = "";
  // Open the modal dialog
  SBOpenModalDialog( "chrome://songbird/content/xul/about.xul", "about", "chrome,modal=yes,centerscreen", about_data );
  if ( about_data.retval == "ok" )
  {
  }  
}

// Debugging Tool
function listProperties(obj, objName) 
{
    var columns = 3;
    var count = 0;
    var result = "";
    for (var i in obj) 
    {
        result += objName + "." + i + " = " + obj[i] + "\t\t\t";
        count = ++count % columns;
        if ( count == columns - 1 )
        {
          result += "\n";
        }
    }
    alert(result);
}

var SBDropObserver = 
{
  getSupportedFlavours : function () 
  {
    var consoleService = Components.classes['@mozilla.org/consoleservice;1']
                            .getService(Components.interfaces.nsIConsoleService);
    consoleService.logStringMessage("get flavours");
    var flavours = new FlavourSet();
    flavours.appendFlavour("application/x-moz-file","nsIFile");
//    flavours.appendFlavour("application/x-moz-url");
    return flavours;
  },
  onDragOver: function ( evt, flavour, session )
  {
  },
  onDrop: function ( evt, dropdata, session )
  {
    if ( dropdata.data != "" )
    {
      // if it has a path property
      if ( dropdata.data.path )
      {
        theDropPath = dropdata.data.path;
        theDropIsDir = dropdata.data.isDirectory();
        setTimeout( SBDropped, 10 ); // Next frame
        
      }
    }
  }
};

var theDropPath = "";
var theDropIsDir = false;
function SBDropped()
{
  if ( IsMediaUrl( theDropPath ) )
  {
    // add it to the db and play it.
    playExternalUrl(theDropPath, false);
  }
  else if ( theDropIsDir )
  {
    theMediaScanIsOpen.setValue( true );
    // otherwise, fire off the media scan page.
    var media_scan_data = new Object();
    media_scan_data.URL = theDropPath;
    media_scan_data.retval = "";
    // Open the non-modal dialog
    SBOpenModalDialog( "chrome://songbird/content/xul/media_scan.xul", "media_scan", "chrome,modal=yes,centerscreen", media_scan_data );
    theMediaScanIsOpen.setValue( false  );
  }
}

function SBGetServiceFromUrl( url, nodefault )
{
  var retval;
  if (!nodefault) retval = url;
  var text = "";
  try
  {
    var theServiceTree = document.getElementById( "frame_servicetree" );
    if ( theServiceTree )
    {
      text += "tree\n";
      var theServiceTree_tree = theServiceTree.tree;
      if (theServiceTree_tree)
      {
        text += "tree_tree\n";
        // Find the columns. 
        var urlcolumn = theServiceTree_tree.columns ? theServiceTree_tree.columns["url"] : "url";
        var labelcolumn = theServiceTree_tree.columns ? theServiceTree_tree.columns["frame_service_tree_label"] : "frame_service_tree_label";
        
        for ( var i = 0; i < theServiceTree_tree.view.rowCount; i++ )
        {
          // Get the text of the hidden tree cell, this contains the url.
          var tree_url = theServiceTree_tree.view.getCellText( i, urlcolumn );
          var tree_label = theServiceTree_tree.view.getCellText( i, labelcolumn );
          
          if ( tree_url == url )
          {
            retval = tree_label;
            break;
          }
          text += "row " + tree_url + "\n";
        }
        text += "end\n";
      }
    }
  }
  catch ( err )
  {
    alert( "SBGetServiceFromUrl - " + err )
  }
  return retval;
}

function SBGetServiceImageFromUrl( url )
{
  retval = "";
  try
  {
    var theServiceTree = document.getElementById( "frame_servicetree" );
    if ( theServiceTree )
    {
      var theServiceTree_tree = theServiceTree.tree;
      if (theServiceTree_tree)
      {
        // Find the columns. 
        var urlcolumn = theServiceTree_tree.columns ? theServiceTree_tree.columns["url"] : "url";
        var labelcolumn = theServiceTree_tree.columns ? theServiceTree_tree.columns["frame_service_tree_label"] : "frame_service_tree_label";
        
        for ( var i = 0; i < theServiceTree_tree.view.rowCount; i++ )
        {
          // Get the text of the hidden tree cell, this contains the url.
          var tree_url = theServiceTree_tree.view.getCellText( i, urlcolumn );
          var tree_image = theServiceTree_tree.view.getImageSrc( i, labelcolumn );
          
          if ( tree_url == url )
          {
            //
            // Uhhhh, what do we do for images that come from the skin?!
            if ( tree_image == "" )
            {
              // For now, use a default.  Assume it's playlisty.
              tree_image = "chrome://songbird/skin/default/icon_lib_16x16.png";
            }
          
            retval = tree_image;
            break;
          }
        }
      }
    }
  }
  catch ( err )
  {
    alert( "SBGetServiceImageFromUrl - " + err )
  }
  return retval;
}

function SBGetUrlFromService( service )
{
  retval = service;
  try
  {
    var theServiceTree = document.getElementById( "frame_servicetree" );
    if ( theServiceTree )
    {
      var theServiceTree_tree = theServiceTree.tree;
      if (theServiceTree_tree)
      {
        // Find the columns. 
        var urlcolumn = theServiceTree_tree.columns ? theServiceTree_tree.columns["url"] : "url";
        var labelcolumn = theServiceTree_tree.columns ? theServiceTree_tree.columns["frame_service_tree_label"] : "frame_service_tree_label";
        
        for ( var i = 0; i < theServiceTree_tree.view.rowCount; i++ )
        {
          // Get the text of the hidden tree cell, this contains the url.
          var tree_url = theServiceTree_tree.view.getCellText( i, urlcolumn );
          var tree_label = theServiceTree_tree.view.getCellText( i, labelcolumn );
          
          if ( tree_label == service )
          {
            retval = tree_url;
            break;
          }
        }
      }
    }
  }
  catch ( err )
  {
    alert( "SBGetUrlFromService - " + err )
  }
  return retval;
}

function SBTabcompleteService( service )
{
  retval = service;
  var service_lc = service.toLowerCase();
  try
  {
    var theServiceTree = document.getElementById( "frame_servicetree" );
    if ( theServiceTree )
    {
      var theServiceTree_tree = theServiceTree.tree;
      if (theServiceTree_tree)
      {
        // Find the columns. 
        var urlcolumn = theServiceTree_tree.columns ? theServiceTree_tree.columns["url"] : "url";
        var labelcolumn = theServiceTree_tree.columns ? theServiceTree_tree.columns["frame_service_tree_label"] : "frame_service_tree_label";

        var found_one = false;      
        for ( var i = 0; i < theServiceTree_tree.view.rowCount; i++ )
        {
          // Get the text of the hidden tree cell, this contains the url.
          var tree_label = theServiceTree_tree.view.getCellText( i, labelcolumn );
          
          var label_lc = tree_label.toLowerCase();
          
          // If we are the beginning of the label string
          if ( label_lc.indexOf( service_lc ) == 0 )
          {
            if ( found_one )
            {
              retval = service; // only find ONE!
              break;
            }
            else
            {
              found_one = true; // only find ONE!
              retval = tree_label;
            }
          }
        }
      }
    }
  }
  catch ( err )
  {
    alert( "SBTabcompleteService - " + err )
  }
  return retval;
}


// Assume there's just one?
var theDownloadContext = new sbIDataRemote( "download.context" );
var theDownloadTable = new sbIDataRemote( "download.table" );
var theDownloadExists = new sbIDataRemote( "browser.hasdownload" );

/*
var theDownloadListener = 
{
  m_queryObj: null,
  m_libraryObj: null,
  
  CreateQueryObj: function()
  {
    this.m_queryObj = new sbIDatabaseQuery();
    this.m_queryObj.SetAsyncQuery(true);
    this.m_queryObj.SetDatabaseGUID("songbird");
  },

  CreateLibraryObj: function()
  {
    if(this.m_libraryObj == null)
    {
      const MediaLibrary = new Components.Constructor("@songbird.org/Songbird/MediaLibrary;1", "sbIMediaLibrary");
      this.m_libraryObj = (new MediaLibrary()).QueryInterface(Components.interfaces.sbIMediaLibrary);
    
      if(this.m_queryObj == null)
          this.CreateQueryObj();
        
      this.m_libraryObj.SetQueryObject(this.m_queryObj);
    }
  },
  
  QueryInterface : function(aIID) 
  {
    if (!aIID.equals(Components.interfaces.sbIDeviceBaseCallback) &&
        !aIID.equals(Components.interfaces.nsISupports)) 
    {
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    return this;
  },
  
  onTransferStart: function(sourceURL, destinationURL)
  {
  },
  
  onTransferComplete: function(sourceURL, destinationURL, transferStatus)
  {
    if(transferStatus == 1)
    {
      this.CreateLibraryObj(); 
      
      var aKeys = ["title"];
      var aValues = [];
      
      var aLocalFile = (Components.classes["@mozilla.org/file/local;1"]).createInstance(Components.interfaces.nsILocalFile);
      aLocalFile.initWithPath(destinationURL);
    
      aValues.push(aLocalFile.leafName);
      this.m_libraryObj.AddMedia(destinationURL, aKeys.length, aKeys, aValues.length, aValues, false, false);
    }
  }
};
*/

function onBrowserTransfer(guid, table, strFilterColumn, nFilterValueCount, aFilterValues)
{
    try
    {
        theWebPlaylistQuery = null; 
          
        aDeviceManager = Components.classes["@songbird.org/Songbird/DeviceManager;1"].
                                    getService(Components.interfaces.sbIDeviceManager);
        if (aDeviceManager)
        {
            var aDownloadDevice = null;
            try {
              aDownloadDevice = aDeviceManager.getDeviceByString('Songbird Download Device');
            }
            catch (e) {}
            
            if (aDownloadDevice)
            {
                // Make a magic data object to get passed to the dialog
                var download_data = new Object();
                download_data.retval = "";
                download_data.value = SBDataGetValue( "download.folder" );
                
                if ( ( SBDataGetIntValue( "download.always" ) == 1 ) && ( download_data.value.length > 0 ) )
                {
                  download_data.retval = "ok";
                }
                else
                {
                  // Open the window
                  SBOpenModalDialog( "chrome://songbird/content/xul/download.xul", "", "chrome,modal=yes,centerscreen", download_data );
                }

                // Pick download destination
                if ( ( download_data.retval == "ok" ) && ( download_data.value.length > 0 ) )
                {
                  var downloadTable = {};
                  // Passing empty string for device name as download device has just one device
                  // Prepare table for download & get the name for newly prepared download table
                  //aDownloadDevice.AddCallback(theDownloadListener);
                  
                  aDownloadDevice.AutoDownloadTable('', guid, table, strFilterColumn, nFilterValueCount, aFilterValues, '', download_data.value, downloadTable);
                  
                  // Record the current download table
                  theDownloadContext.setValue( aDownloadDevice.GetContext('') )
                  theDownloadTable.setValue( downloadTable.value );
                  theDownloadExists.setValue( true );
                  
                  // Register the guid and table with the playlist source to always show special download commands.
                  SBDownloadCommands.m_Device = aDownloadDevice;
                  var source = new sbIPlaylistsource();
                  source.RegisterPlaylistCommands( aDownloadDevice.GetContext(''), downloadTable.value, "download", SBDownloadCommands );
                }
            }
        }
    }
    
    catch ( err )
    {
        alert( err );
    }
}

var SBDownloadCommands = 
{
  DEVICE_IDLE :               0,
  DEVICE_BUSY :               1,
  DEVICE_DOWNLOADING :        2,
  DEVICE_UPLOADING :          3,
  DEVICE_DOWNLOAD_PAUSED :    4,
  DEVICE_UPLOAD_PAUSED :      5,
  DEVICE_DELETING :           6,
  
  m_Playlist: null,
  m_Device: null,

  m_Ids: new Array
  (
    "library_cmd_play",
    "library_cmd_remove",
    "library_cmd_pause",
    "*separator*",
    "library_cmd_showwebplaylist"
  ),
  
  m_Names: new Array
  (
    "&command.play",
    "&command.remove",
    "&command.pause",
    "*separator*",
    "&command.showwebplaylist"
  ),
  
  m_Tooltips: new Array
  (
    "&command.tooltip.play",
    "&command.tooltip.remove",
    "&command.tooltip.pause",
    "*separator*",
    "&command.tooltip.showwebplaylist"
  ),

  GetNumCommands: function()
  {
    if ( 
        ( this.m_Tooltips.length != this.m_Ids.length ) ||
        ( this.m_Names.length != this.m_Ids.length ) ||
        ( this.m_Tooltips.length != this.m_Names.length )
       )
    {
      alert( "PlaylistCommands - Array lengths do not match!" );
      return 0;
    }
    return this.m_Ids.length;
  },

  GetCommandId: function( index )
  {
    // Ah! magic number - what does it mean???
    if ( index == 2 ) 
    {
      if ( this.m_Device )
      {
        if ( this.m_Device.GetDeviceState('') == this.DEVICE_DOWNLOAD_PAUSED )
        {
          this.m_Ids[ index ] = "library_cmd_resume";
        }
        else
        {
          this.m_Ids[ index ] = "library_cmd_pause";
        }
      }
    }
    if ( index >= this.m_Ids.length )
    {
      return "";
    }
    return this.m_Ids[ index ];
  },

  GetCommandText: function( index )
  {
    if ( index == 2 )
    {
      if ( this.m_Device )
      {
        if ( this.m_Device.GetDeviceState('') == this.DEVICE_DOWNLOAD_PAUSED )
        {
          this.m_Names[ index ] = "&command.resume";
        }
        else
        {
          this.m_Names[ index ] = "&command.pause";
        }
      }
    }
    if ( index >= this.m_Names.length )
    {
      return "";
    }
    return this.m_Names[ index ];
  },

  GetCommandFlex: function( index )
  {
    if ( this.m_Ids[ index ] == "*separator*" ) return 1;
    return 0;
  },

  GetCommandToolTipText: function( index )
  {
    if ( index == 2 )
    {
      if ( this.m_Device )
      {
        if ( this.m_Device.GetDeviceState('') == this.DEVICE_DOWNLOAD_PAUSED )
        {
          this.m_Tooltips[ index ] = "&command.tooltip.resume";
        }
        else
        {
          this.m_Tooltips[ index ] = "&command.tooltip.pause";
        }
      }
    }
    if ( index >= this.m_Tooltips.length )
    {
      return "";
    }
    return this.m_Tooltips[ index ];
  },

  GetCommandEnabled: function( index )
  {
    var retval = false;
    if ( this.m_Device )
    {
      switch( index )
      {
        case 2:
          retval = ( this.m_Device.GetDeviceState('') == this.DEVICE_DOWNLOADING ) || ( this.m_Device.GetDeviceState('') == this.DEVICE_DOWNLOAD_PAUSED )
        break;
        default:
          retval = true;
        break;
      }
    }
    return retval;
  },

  OnCommand: function( event )
  {
    if ( this.m_Device && event.target && event.target.id )
    {
      // Was it from the toolbarbutton?
      var tbb = ( event.target.tagName == "button" || event.target.tagName == "xul:button" );
      switch( event.target.id )
      {
        case "library_cmd_play":
          if ( this.m_Playlist.tree.currentIndex != -1 )
          {
            // Repurpose the command to act as if a doubleclick
            this.m_Playlist.sendPlayEvent();
          }
        break;
        case "library_cmd_remove":
          if ( this.m_Playlist.tree.currentIndex != -1 )
          {
            // remove the currently select tracks
            this.m_Playlist.removeTracks();
          }
        break;
        case "library_cmd_pause":
        case "library_cmd_resume":
          if ( this.m_Device.GetDeviceState('') == this.DEVICE_DOWNLOADING )
          {
            this.m_Device.SuspendTransfer('');
          }
          else if ( this.m_Device.GetDeviceState('') == this.DEVICE_DOWNLOAD_PAUSED )
          {
            this.m_Device.ResumeTransfer('');
          }
          // Since we changed state, update the command buttons.
          this.m_Playlist.refreshCommands();
        break;
        case "library_cmd_showwebplaylist":
        {
          onBrowserPlaylist();
        }
        break;
      }
      event.stopPropagation();
    }
  },
  
  // The object registered with the sbIPlaylistSource interface acts 
  // as a template for instances bound to specific playlist elements
  Duplicate: function()
  {
    var obj = {};
    for ( var i in this )
    {
      obj[ i ] = this[ i ];
    }
    return obj;
  },
  
  SetPlaylist: function( playlist )
  {
    this.m_Playlist = playlist;
  },
  
  QueryInterface : function(aIID)
  {
    if (!aIID.equals(Components.interfaces.sbIPlaylistCommands) &&
        !aIID.equals(Components.interfaces.nsISupportsWeakReference) &&
        !aIID.equals(Components.interfaces.nsISupports)) 
    {
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    
    return this;
  }

}


// Register the download commands at startup if we know what the download table is.
var aDeviceManager = Components.classes["@songbird.org/Songbird/DeviceManager;1"].
                                getService(Components.interfaces.sbIDeviceManager);

if (aDeviceManager)
{
  var aDownloadDevice = null;
  try {
    aDownloadDevice = aDeviceManager.getDeviceByString('Songbird Download Device');
  }
  catch (e) {}
  
  if (aDownloadDevice)
  {
    SBDownloadCommands.m_Device = aDownloadDevice;
    var guid = aDownloadDevice.GetContext('');
    var table = "download"; // aDownloadDevice.GetTransferTableName('');
    var source = new sbIPlaylistsource();
    try
    {
      source.RegisterPlaylistCommands( guid, table, "download", SBDownloadCommands );
    }
    catch ( err )
    {
      alert( "source.RegisterPlaylistCommands( " + guid+ ", " + table+ " );\r\n" + err )
    }
  }
}


var SBCDCommands = 
{
  DEVICE_IDLE :               0,
  DEVICE_BUSY :               1,
  DEVICE_DOWNLOADING :        2,
  DEVICE_UPLOADING :          3,
  DEVICE_DOWNLOAD_PAUSED :    4,
  DEVICE_UPLOAD_PAUSED :      5,
  DEVICE_DELETING :           6,
  
  m_Playlist: null,
  m_Device: null,
  m_Context: null, 
  m_Table: null,
  m_DeviceName: null,

  m_Ids: new Array
  (
    "library_cmd_play",
    "library_cmd_rip",
    "library_cmd_edit"
  ),
  
  m_Names: new Array
  (
    "&command.play",
    "&command.rip",
    "&command.edit"
  ),
  
  m_Tooltips: new Array
  (
    "&command.tooltip.play",
    "&command.tooltip.rip",
    "&command.tooltip.edit"
  ),

  GetNumCommands: function()
  {
    if ( 
        ( this.m_Tooltips.length != this.m_Ids.length ) ||
        ( this.m_Names.length != this.m_Ids.length ) ||
        ( this.m_Tooltips.length != this.m_Names.length )
       )
    {
      alert( "PlaylistCommands - Array lengths do not match!" );
      return 0;
    }
    return this.m_Ids.length;
  },

  GetCommandId: function( index )
  {
    if ( index >= this.m_Ids.length )
    {
      return "";
    }
    return this.m_Ids[ index ];
  },

  GetCommandText: function( index )
  {
    if ( index >= this.m_Names.length )
    {
      return "";
    }
    return this.m_Names[ index ];
  },

  GetCommandFlex: function( index )
  {
    if ( this.m_Ids[ index ] == "*separator*" ) return 1;
    return 0;
  },


  GetCommandToolTipText: function( index )
  {
    if ( index >= this.m_Tooltips.length )
    {
      return "";
    }
    return this.m_Tooltips[ index ];
  },

  GetCommandEnabled: function( index )
  {
    var retval = false;
    if ( this.m_Device )
    {
      switch( index )
      {
        case 0:
        case 1:
        case 2:
          retval = true;
        break;
      }
    }
    return retval;
  },

  OnCommand: function( event )
  {
    if ( this.m_Device && event.target && event.target.id )
    {
      // Was it from the toolbarbutton?
      var tbb = ( event.target.tagName == "button" || event.target.tagName == "xul:button" );
      switch( event.target.id )
      {
        case "library_cmd_play":
          if ( this.m_Playlist.tree.currentIndex != -1 )
          {
            // Repurpose the command to act as if a doubleclick
            this.m_Playlist.sendPlayEvent();
          }
        break;
        case "library_cmd_rip":
          if ( this.m_Playlist.tree.currentIndex != -1 )
          {
            try
            {        
                var filterCol = "uuid";
                var filterVals = new Array();
                
                var columnObj = this.m_Playlist.tree.columns.getNamedColumn(filterCol);
                var rangeCount = this.m_Playlist.tree.view.selection.getRangeCount();
                for (var i=0; i < rangeCount; i++) 
                {
                    var start = {};
                    var end = {};
                    this.m_Playlist.tree.view.selection.getRangeAt( i, start, end );
                    for( var c = start.value; c <= end.value; c++ )
                    {
                        if (c >= this.m_Playlist.tree.view.rowCount) 
                        {
                        continue; 
                        }
                        
                        var value = this.m_Playlist.tree.view.getCellText(c, columnObj);
                        
                        filterVals.push(value);
                    }
                }
                onCDRip( this.m_DeviceName, this.m_Context, this.m_Table, filterCol, filterVals.length, filterVals, this.m_Device);
                // And show the download table in the chrome playlist.
                //onBrowserDownload();
            }
            catch( err )          
            {
                alert( err );
            }
          }
        break;
        case "library_cmd_edit":
        break;
      }
      event.stopPropagation();
    }
  },
  
  // The object registered with the sbIPlaylistSource interface acts 
  // as a template for instances bound to specific playlist elements
  Duplicate: function()
  {
    var obj = {};
    for ( var i in this )
    {
      obj[ i ] = this[ i ];
    }
    return obj;
  },
  
  SetPlaylist: function( playlist )
  {
    this.m_Playlist = playlist;
  },
  
  QueryInterface : function(aIID)
  {
    if (!aIID.equals(Components.interfaces.sbIPlaylistCommands) &&
        !aIID.equals(Components.interfaces.nsISupportsWeakReference) &&
        !aIID.equals(Components.interfaces.nsISupports)) 
    {
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    
    return this;
  }

};

var SBRippingCommands = 
{
  DEVICE_IDLE :               0,
  DEVICE_BUSY :               1,
  DEVICE_DOWNLOADING :        2,
  DEVICE_UPLOADING :          3,
  DEVICE_DOWNLOAD_PAUSED :    4,
  DEVICE_UPLOAD_PAUSED :      5,
  DEVICE_DELETING :           6,
  
  m_Playlist: null,
  m_Device: null,
  m_DeviceName: null,

  m_Ids: new Array
  (
    "library_cmd_remove"
  ),
  
  m_Names: new Array
  (
    "&command.remove"
  ),
  
  m_Tooltips: new Array
  (
    "&command.tooltip.remove"
  ),

  GetNumCommands: function()
  {
    if ( 
        ( this.m_Tooltips.length != this.m_Ids.length ) ||
        ( this.m_Names.length != this.m_Ids.length ) ||
        ( this.m_Tooltips.length != this.m_Names.length )
       )
    {
      alert( "PlaylistCommands - Array lengths do not match!" );
      return 0;
    }
    return this.m_Ids.length;
  },

  GetCommandId: function( index )
  {
    if ( index >= this.m_Ids.length )
    {
      return "";
    }
    return this.m_Ids[ index ];
  },

  GetCommandText: function( index )
  {
    if ( index >= this.m_Names.length )
    {
      return "";
    }
    return this.m_Names[ index ];
  },

  GetCommandFlex: function( index )
  {
    if ( this.m_Ids[ index ] == "*separator*" ) return 1;
    return 0;
  },

  GetCommandToolTipText: function( index )
  {
    if ( index >= this.m_Tooltips.length )
    {
      return "";
    }
    return this.m_Tooltips[ index ];
  },

  GetCommandEnabled: function( index )
  {
    var retval = false;
    if ( this.m_Device )
    {
      switch( index )
      {
        default:
          retval = true;
        break;
      }
    }
    return retval;
  },

  OnCommand: function( event )
  {
    if ( this.m_Device && event.target && event.target.id )
    {
      // Was it from the toolbarbutton?
      var tbb = ( event.target.tagName == "button" || event.target.tagName == "xul:button" );
      switch( event.target.id )
      {
        case "library_cmd_remove":
          if ( this.m_Playlist.tree.currentIndex != -1 )
          {
            // remove the currently select tracks
            this.m_Playlist.removeTracks();
          }
        break;
      }
      event.stopPropagation();
    }
  },
  
  // The object registered with the sbIPlaylistSource interface acts 
  // as a template for instances bound to specific playlist elements
  Duplicate: function()
  {
    var obj = {};
    for ( var i in this )
    {
      obj[ i ] = this[ i ];
    }
    return obj;
  },
  
  SetPlaylist: function( playlist )
  {
    this.m_Playlist = playlist;
  },
  
  QueryInterface : function(aIID)
  {
    if (!aIID.equals(Components.interfaces.sbIPlaylistCommands) &&
        !aIID.equals(Components.interfaces.nsISupportsWeakReference) &&
        !aIID.equals(Components.interfaces.nsISupports)) 
    {
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    
    return this;
  }

};


function onCDRip(deviceName, guid, table, strFilterColumn, nFilterValueCount, aFilterValues, aCDDevice)
{
    try
    {
        theWebPlaylistQuery = null; 
          
        if (aCDDevice)
        {
            // Make a magic data object to get passed to the dialog
            var ripping_data = new Object();
            ripping_data.retval = "";
            ripping_data.value = SBDataGetValue( "ripping.folder" );
            
            if ( ( SBDataGetIntValue( "ripping.always" ) == 1 ) && ( ripping_data.value.length > 0 ) )
            {
                ripping_data.retval = "ok";
            }
            else
            {
                // Open the window
                SBOpenModalDialog( "chrome://songbird/content/xul/download.xul", "", "chrome,modal=yes,centerscreen", ripping_data );
            }

            // Pick download destination
            if ( ( ripping_data.retval == "ok" ) && ( ripping_data.value.length > 0 ) )
            {
                var rippingTable = {};
                // Passing empty string for device name as download device has just one device
                // Prepare table for download & get the name for newly prepared download table
                //aDownloadDevice.AddCallback(theDownloadListener);
                
                aCDDevice.AutoDownloadTable(deviceName, guid, table, strFilterColumn, nFilterValueCount, aFilterValues, '', ripping_data.value, rippingTable);
                
                // Register the guid and table with the playlist source to always show special download commands.
                SBRippingCommands.m_Device = aCDDevice;
                SBRippingCommands.m_DeviceName = deviceName;
                var source = new sbIPlaylistsource();
                source.RegisterPlaylistCommands( guid, rippingTable.value, "download", SBRippingCommands );
            }
        }
    }
    
    catch ( err )
    {
        alert( err );
    }
}

var theCDListener = 
{
  m_queryObj: null,
  m_libraryObj: null,
  
  CreateQueryObj: function()
  {
    this.m_queryObj = new sbIDatabaseQuery();
    this.m_queryObj.SetAsyncQuery(true);
    this.m_queryObj.SetDatabaseGUID("songbird");
  },

  CreateLibraryObj: function()
  {
    if(this.m_libraryObj == null)
    {
      const MediaLibrary = new Components.Constructor("@songbird.org/Songbird/MediaLibrary;1", "sbIMediaLibrary");
      this.m_libraryObj = (new MediaLibrary()).QueryInterface(Components.interfaces.sbIMediaLibrary);
    
      if(this.m_queryObj == null)
          this.CreateQueryObj();
        
      this.m_libraryObj.SetQueryObject(this.m_queryObj);
    }
  },
  
  QueryInterface : function(aIID) 
  {
    if (!aIID.equals(Components.interfaces.sbIDeviceBaseCallback) &&
        !aIID.equals(Components.interfaces.nsISupports)) 
    {
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    return this;
  },
  
  onTransferStart: function(sourceURL, destinationURL)
  {
  },
  
  onTransferComplete: function(sourceURL, destinationURL, transferStatus)
  {
  },
  
  onDeviceConnect: function(deviceName)
  {
    OnCDInsert(deviceName);
  },
  
  onDeviceDisconnect: function(deviceName)
  {
  }
};

function OnCDInsert(deviceName)
{
  if (aDeviceManager)
  {
    var aCDDevice = null;
    try {
      aCDDevice = aDeviceManager.getDeviceByString('Songbird CD Device');
    }
    catch (e) {}
    
    if (aCDDevice)
    {
      SBCDCommands.m_DeviceName = deviceName;
      SBCDCommands.m_Device = aCDDevice;
      var cdTable = {};
      var cdContext = {};
      aCDDevice.GetTrackTable(SBCDCommands.m_DeviceName, cdContext, cdTable);
      cdContext = cdContext.value;
      cdTable = cdTable.value;
      SBCDCommands.m_Context = cdContext;
      SBCDCommands.m_Table = cdTable;
      var source = new sbIPlaylistsource();
      if ( cdContext && cdTable )
      {
        try
        {
          source.RegisterPlaylistCommands( cdContext, cdTable, cdTable, SBCDCommands );
        }
        catch ( err )
        {
          alert( "source.RegisterPlaylistCommands( " + SBCDCommands.m_Context + ", " + SBCDCommands.m_Table+ " );\r\n" + err )
        }
      }
    }
  }
}


// Register for CD notifications
if (aDeviceManager)
{
    var aCDDevice = null;
    try {
      aCDDevice = aDeviceManager.getDeviceByString('Songbird CD Device');
    }
    catch (e) {}
    
    if (aCDDevice)
    {
        try
        {
            aCDDevice.AddCallback(theCDListener);
            if (aCDDevice.GetNumDevices() > 0)
            {
			  // Currently handling just the first device
			  OnCDInsert(aCDDevice.EnumDeviceString(0));
            }
        }
        catch ( err )
        {
            alert( "aCDDevice.AddCallback(theCDListener);\r\n" + err );
        }
    }
}


var SBCDBurningCommands = 
{
  DEVICE_IDLE :               0,
  DEVICE_BUSY :               1,
  DEVICE_DOWNLOADING :        2,
  DEVICE_UPLOADING :          3,
  DEVICE_DOWNLOAD_PAUSED :    4,
  DEVICE_UPLOAD_PAUSED :      5,
  DEVICE_DELETING :           6,
  
  m_Playlist: null,
  m_Device: null,
  m_DeviceName: null,
  m_TableName: null,

  m_Ids: new Array
  (
    "library_cmd_start",
    "library_cmd_stop"
  ),
  
  m_Names: new Array
  (
    "&command.start",
    "&command.stop"
  ),
  
  m_Tooltips: new Array
  (
    "&command.tooltip.start",
    "&command.tooltip.stop"
  ),

  GetNumCommands: function()
  {
    if ( 
        ( this.m_Tooltips.length != this.m_Ids.length ) ||
        ( this.m_Names.length != this.m_Ids.length ) ||
        ( this.m_Tooltips.length != this.m_Names.length )
       )
    {
      alert( "PlaylistCommands - Array lengths do not match!" );
      return 0;
    }
    return this.m_Ids.length;
  },

  GetCommandId: function( index )
  {
    if ( index >= this.m_Ids.length )
    {
      return "";
    }
    return this.m_Ids[ index ];
  },

  GetCommandText: function( index )
  {
    if ( index >= this.m_Names.length )
    {
      return "";
    }
    return this.m_Names[ index ];
  },

  GetCommandFlex: function( index )
  {
    if ( this.m_Ids[ index ] == "*separator*" ) return 1;
    return 0;
  },

  GetCommandToolTipText: function( index )
  {
    if ( index >= this.m_Tooltips.length )
    {
      return "";
    }
    return this.m_Tooltips[ index ];
  },

  GetCommandEnabled: function( index )
  {
    var retval = false;
    if ( this.m_Device )
    {
      switch( index )
      {
        default:
          retval = true;
        break;
      }
    }
    return retval;
  },

  OnCommand: function( event )
  {
    if ( this.m_Device && event.target && event.target.id )
    {
      // Was it from the toolbarbutton?
      var tbb = ( event.target.tagName == "toolbarbutton" || event.target.tagName == "xul:toolbarbutton" );
      switch( event.target.id )
      {
        case "library_cmd_start":
            // start CD rip
            //onBrowserCDTransfer(this.m_Device, this.m_DeviceName, 0 );
            onStartCDBurn(this.m_Device, this.m_DeviceName, this.m_TableName);
        break;
        case "library_cmd_stop":
            // stop CD rip
            onStopCDBurn(this.m_DeviceName, this.m_Device);
        break;
      }
      event.stopPropagation();
    }
  },
  
  // The object registered with the sbIPlaylistSource interface acts 
  // as a template for instances bound to specific playlist elements
  Duplicate: function()
  {
    var obj = {};
    for ( var i in this )
    {
      obj[ i ] = this[ i ];
    }
    return obj;
  },
  
  SetPlaylist: function( playlist )
  {
    this.m_Playlist = playlist;
  },
  
  QueryInterface : function(aIID)
  {
    if (!aIID.equals(Components.interfaces.sbIPlaylistCommands) &&
        !aIID.equals(Components.interfaces.nsISupportsWeakReference) &&
        !aIID.equals(Components.interfaces.nsISupports)) 
    {
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    
    return this;
  }

};

function onStartCDBurn(cdDevice, deviceName, table)
{
  try
  {
    if (cdDevice != null)
    {
      CheckCDAvailableForBurn();
      if (cdAvailableForWrite)
      {
        cdDevice.UploadTable(deviceName, table);
      }
    }
  }
  
  catch (err)
  {
    alert(err);
  }
}

var cdAvailableForWrite = 0;
var writableCDDeviceString = '';

function onAddToCDBurn(guid, table, strFilterColumn, nFilterValueCount, aFilterValues)
{
    try
    {
        theWebPlaylistQuery = null; 
        // deviceName is ignored for now and we ask cd device for the writable cd drive
        CheckCDAvailableForBurn();
        if (cdAvailableForWrite == 0)
           return; 
                
        var burnTable = {};
        
        // CD burning will be a two step process, user has to click the 'burn' button to initiate a CD burn
        aCDDevice.MakeTransferTable(writableCDDeviceString, guid, table, strFilterColumn, nFilterValueCount, aFilterValues, '', '', false, burnTable);
        
        // Register the guid and table with the playlist source to always show special burn commands.
        SBCDBurningCommands.m_Device = aCDDevice;
        SBCDBurningCommands.m_DeviceName = writableCDDeviceString;
        SBCDBurningCommands.m_TableName = burnTable.value;
        var source = new sbIPlaylistsource();
        source.RegisterPlaylistCommands( aCDDevice.GetContext(writableCDDeviceString), burnTable.value, burnTable.value, SBCDBurningCommands );

        // And show the download table in the chrome playlist.
        //onBrowserCDTransfer(aCDDevice, writableCDDeviceString, 0 /*Burning*/);
    }
    
    catch ( err )
    {
        alert( err );
    }
}

function CheckCDAvailableForBurn()
{
    cdAvailableForWrite = 0;
    aDeviceManager = Components.classes["@songbird.org/Songbird/DeviceManager;1"].getService(Components.interfaces.sbIDeviceManager);
    if (aDeviceManager)
    {
        aCDDevice = aDeviceManager.getDeviceByString('Songbird CD Device');
    }

    if (!aCDDevice)
    {
        return;
    }
	aCDDevice = aCDDevice.QueryInterface(Components.interfaces.sbICDDevice);
    if (!aCDDevice)
    {
        return;
    }

    var temp = {};
    if (!aCDDevice.GetWritableCDDrive(temp))
    {
        return;
    }
    writableCDDeviceString = temp.value;
    
    if (!aCDDevice.IsUploadSupported(writableCDDeviceString))
    {
        return;
    }

    if (aCDDevice.GetAvailableSpace(writableCDDeviceString) == 0)
    {
        return;
    }
    
	alert("Writable CD Found at " + writableCDDeviceString);
    cdAvailableForWrite = 1;
}

function onStopCDBurn(deviceName, aCDDevice)
{
  if (aCDDevice)
  {
    aCDDevice.AbortTransfer(deviceName);
  }
}

function onBrowserCDTransfer(cdDevice, deviceString, ripping)
{  
  if  (ripping == 1)
	metrics_inc("player", "cd ripping", null);
  else
	metrics_inc("player", "cd burning", null);
    
  // Work to figure out guid and table
  var guid = cdDevice.GetContext(deviceString);
  var table;
  if (ripping)
    table = cdDevice.GetDownloadTable(deviceString);
  else
    table = cdDevice.GetUploadTable(deviceString);

  // Actual functionality
  if ( ! thePlaylistTree )
  {
    // Errrr, nope?
    if ( ( guid == "" ) || ( table == "" ) )
    {
      return;
    }

    if ( theWebPlaylist.ref != ( "NC:" + guid + "_" + table ) )
    {
      if (ripping)
        theWebPlaylist.bind( guid, table, null, SBCDRippingCommands, SBDataGetValue( "browser.playlist.height" ), SBDataGetValue( "browser.playlist.collapsed" ) );
      else
        theWebPlaylist.bind( guid, table, null, SBCDBurningCommands, SBDataGetValue( "browser.playlist.height" ), SBDataGetValue( "browser.playlist.collapsed" ) );
    }
    
    // Show/hide them
    theShowWebPlaylistData.SetValue( true );
  }
  else
  {
    var theServiceTree = document.getElementById( 'frame_servicetree' );
    theServiceTree.LaunchURL( "chrome://songbird/content/xul/main_pane.xul?" + table + "," + guid );
  }

}// END

}
catch ( err )
{
  alert( err );
}

// alert( "success!" );
// END

