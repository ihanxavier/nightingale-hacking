/*
 //
 // BEGIN SONGBIRD GPL
 //
 // This file is part of the Songbird web player.
 //
 // Copyright(c) 2005-2009 POTI, Inc.
 // http://songbirdnest.com
 //
 // This file may be licensed under the terms of of the
 // GNU General Public License Version 2 (the "GPL").
 //
 // Software distributed under the License is distributed
 // on an "AS IS" basis, WITHOUT WARRANTY OF ANY KIND, either
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

#include "sbiTunesXMLParser.h"

#include <prlog.h>
#include <nsComponentManagerUtils.h>
#include <nsISAXAttributes.h>
#include <nsISAXLocator.h>
#include <nsIInputStreamPump.h>
#include <nsThreadUtils.h>

#include <sbIiTunesXMLParserListener.h>
#include <sbProxiedComponentManager.h>

#include <sbFileUtils.h>

PRUint32 CHUNK_SIZE = 10 * 1024; // 10k of data at a time

inline 
nsString BuildErrorMessage(char const * aType,
                            nsISAXLocator * aLocator,
                            nsAString const & aError) {
  PRInt32 line = 0;
  PRInt32 column = 0;
  aLocator->GetLineNumber(&line);
  aLocator->GetColumnNumber(&column);
  nsString msg;
  msg.AppendLiteral(aType);
  msg.AppendLiteral(" occurred at line ");
  msg.AppendInt(line, 10);
  msg.AppendLiteral(" column ");
  msg.AppendInt(column, 10); 
  msg.Append(aError);
  return msg;
}

#ifdef PR_LOGGING
static PRLogModuleInfo* giTunesXMLParserLog = nsnull;
#define TRACE(args) \
  PR_BEGIN_MACRO \
  if (!giTunesXMLParserLog) \
  giTunesXMLParserLog = PR_NewLogModule("sbiTunesXMLParser"); \
  PR_LOG(giTunesXMLParserLog, PR_LOG_DEBUG, args); \
  PR_END_MACRO
#define LOG(args) \
  PR_BEGIN_MACRO \
  if (!giTunesXMLParserLog) \
  giTunesXMLParserLog = PR_NewLogModule("sbiTunesXMLParser"); \
  PR_LOG(giTunesXMLParserLog, PR_LOG_WARN, args); \
  PR_END_MACRO

/**
 * Logs the start element data
 */
inline
void LogStartElement(const nsAString & aURI,
    const nsAString & aLocalName,
    const nsAString & aQName,
    nsISAXAttributes * aAttributes) {
  LOG(("StartElement: URI=%s localName=%s qName=%s\n",
          NS_LossyConvertUTF16toASCII(aURI).get(),
          NS_LossyConvertUTF16toASCII(aLocalName).get(),
          NS_LossyConvertUTF16toASCII(aQName).get()));
  PRInt32 length;
  aAttributes->GetLength(&length);
  nsString name;
  nsString value;
  for (PRInt32 index = 0; index < length; ++index) {
    aAttributes->GetLocalName(index, name);
    aAttributes->GetValue(index, value);
    LOG(("  %s:%s\n",
            NS_LossyConvertUTF16toASCII(name).get(),
            NS_LossyConvertUTF16toASCII(value).get()));
  }
}

/**
 * Logs errors and warnings
 */
inline
void LogError(char const * aType,
    nsISAXLocator * aLocator,
    nsAString const & aError) {
  LOG((NS_LossyConvertUTF16toASCII(BuildErrorMessage(aType, aLocator, aError)).get()));
}

#else
#define TRACE(args) /* nothing */
#define LOG(args)   /* nothing */
inline
void LogStartElement(const nsAString & aURI,
                     const nsAString & aLocalName,
                     const nsAString & qName,
                     nsISAXAttributes * aAttributes) {
}
inline
void LogError(char const * aType,
              nsISAXLocator * aLocator,
              nsAString const & aError) {
}
#endif /* PR_LOGGING */

/**
 * Stream listener class that allows us process UI requests while parsing the stream
 */
class sbiTunesImporterStreamListener : public nsIStreamListener
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSISTREAMLISTENER
  NS_DECL_NSIREQUESTOBSERVER
  sbiTunesImporterStreamListener(nsISAXXMLReader * aReader);

private:
  ~sbiTunesImporterStreamListener();

  nsISAXXMLReaderPtr mReader;
};

NS_IMPL_ISUPPORTS2(sbiTunesImporterStreamListener, nsIStreamListener,
                                                   nsIRequestObserver)

sbiTunesImporterStreamListener::sbiTunesImporterStreamListener(nsISAXXMLReader * aReader) :
  mReader(aReader) {
}

sbiTunesImporterStreamListener::~sbiTunesImporterStreamListener() 
{
}

/**
 *  void onDataAvailable (in nsIRequest aRequest, 
 *                       in nsISupports aContext, 
 *                       in nsIInputStream aInputStream, 
 *                       in unsigned long aOffset, 
 *                       in unsigned long aCount);
 */
NS_IMETHODIMP 
sbiTunesImporterStreamListener::OnDataAvailable(nsIRequest *aRequest, 
                                                nsISupports *aContext, 
                                                nsIInputStream *aInputStream, 
                                                PRUint32 aOffset, 
                                                PRUint32 aCount)
{
  NS_ENSURE_ARG_POINTER(aRequest);
  NS_ENSURE_ARG_POINTER(aInputStream);
  NS_PRECONDITION(mReader, "mReader not initialized");
  
  nsresult rv =  mReader->OnDataAvailable(aRequest,
                                          aContext,
                                          aInputStream,
                                          aOffset,
                                          aCount);

  NS_ENSURE_SUCCESS(rv, rv);
  
  return NS_OK;
}

// nsIRequestObserver

/* void onStartRequest (in nsIRequest aRequest, in nsISupports aContext); */
NS_IMETHODIMP
sbiTunesImporterStreamListener::OnStartRequest(nsIRequest *aRequest,
                                               nsISupports *aContext)
{
  NS_ENSURE_ARG_POINTER(aRequest);
  NS_PRECONDITION(mReader, "mReader not initialized");
  
  return mReader->OnStartRequest(aRequest, aContext);
}

/* void onStopRequest (in nsIRequest aRequest, in nsISupports aContext, in nsresult aStatusCode); */
NS_IMETHODIMP
sbiTunesImporterStreamListener::OnStopRequest(nsIRequest *aRequest,
                                              nsISupports *aContext,
                                              nsresult aStatusCode)
{
  NS_ENSURE_ARG_POINTER(aRequest);
  NS_PRECONDITION(mReader, "mReader not initialized");
  
  return mReader->OnStopRequest(aRequest, aContext, aStatusCode);
}

NS_IMPL_THREADSAFE_ISUPPORTS3(sbiTunesXMLParser,
    sbIiTunesXMLParser,
    nsISAXContentHandler,
    nsISAXErrorHandler)

/* Constants */
char const XML_CONTENT_TYPE[] = "text/xml";
char const NS_SAXXMLREADER_CONTRACTID[] = "@mozilla.org/saxparser/xmlreader;1";

sbiTunesXMLParser * sbiTunesXMLParser::New() {
  return new sbiTunesXMLParser;
}

sbiTunesXMLParser::sbiTunesXMLParser() : mState(START) {
  MOZ_COUNT_CTOR(sbiTunesXMLParser);
  nsISAXXMLReaderPtr const & reader = GetSAXReader();
}

sbiTunesXMLParser::~sbiTunesXMLParser() {
  Finalize();MOZ_COUNT_DTOR(sbiTunesXMLParser);
}

/* sbIiTunesXMLParser implementation */

NS_IMETHODIMP sbiTunesXMLParser::Parse(nsIInputStream * aiTunesXMLStream,
                                       sbIiTunesXMLParserListener * aListener) {

  nsresult rv;
  
  /**
   * Need to ensure the enumeration is ordered as we expect
   */
  NS_ENSURE_TRUE(TOP_LEVEL_PROPERTIES == TOP_LEVEL_PROPERTY_NAME - 1 &&
                 TOP_LEVEL_PROPERTY_NAME == TOP_LEVEL_PROPERTY_VALUE - 1 &&
                 TRACK == TRACK_PROPERTY_NAME - 1 &&
                 TRACK_PROPERTY_NAME == TRACK_PROPERTY_VALUE - 1 &&   
                 PLAYLIST == PLAYLIST_PROPERTY_NAME -1 &&
                 PLAYLIST_PROPERTY_NAME == PLAYLIST_PROPERTY_VALUE - 1 && 
                 PLAYLIST_ITEM == PLAYLIST_ITEM_NAME - 1 && 
                 PLAYLIST_ITEM_NAME == PLAYLIST_ITEM_VALUE - 1,
                 NS_ERROR_FAILURE);
  NS_ENSURE_ARG_POINTER(aiTunesXMLStream);
  NS_ENSURE_ARG_POINTER(aListener);
  /* Update status. */

  mListener = aListener;
  
  rv = InitializeProperties();
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsISAXXMLReaderPtr const & reader = GetSAXReader();

  rv = reader->SetContentHandler(this);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = reader->SetErrorHandler(this);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = reader->ParseAsync(nsnull);
  
  mPump = do_CreateInstance("@mozilla.org/network/input-stream-pump;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = mPump->Init(aiTunesXMLStream, -1, -1, CHUNK_SIZE, 1, PR_TRUE);
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIStreamListener> streamListener = new sbiTunesImporterStreamListener(mSAXReader);
  rv = mPump->AsyncRead(streamListener, nsnull);
  
  NS_ENSURE_SUCCESS(rv, rv);
  
  return NS_OK;
}

/* void finalize(); */
NS_IMETHODIMP sbiTunesXMLParser::Finalize() {
  mSAXReader = nsnull;
  mProperties = nsnull;
  mListener = nsnull;
  mTracks.Clear();
  return NS_OK;
}

nsISAXXMLReaderPtr const & sbiTunesXMLParser::GetSAXReader() {
  if (!mSAXReader) {
    nsresult rv;
    mSAXReader = do_CreateInstance(NS_SAXXMLREADER_CONTRACTID, &rv);
    NS_WARN_IF_FALSE(NS_SUCCEEDED(rv), "Unable to create xmlreader");
  }
  return mSAXReader;
}

/* nsISAXContentHandler implementation */

/* void startDocument (); */
NS_IMETHODIMP
sbiTunesXMLParser::StartDocument() {
  LOG(("StartDocument\n"));
  mState = START;
  return NS_OK;
}

/* void endDocument (); */
NS_IMETHODIMP
sbiTunesXMLParser::EndDocument() {
  LOG(("EndDocument\n"));
  return NS_OK;
}

/* void startElement (in AString uri, in AString localName, in AString qName, in nsISAXAttributes attributes); */
NS_IMETHODIMP 
sbiTunesXMLParser::StartElement(const nsAString & uri,
                                              const nsAString & localName,
                                              const nsAString & qName,
                                              nsISAXAttributes *attributes) {
  LogStartElement(uri, localName, qName, attributes);
  // Is this a key element
  if (localName.EqualsLiteral("key")) {
    // Based on the current state, change the state to a "name" state
    switch (mState) {
      case TOP_LEVEL_PROPERTIES: {
        mState = TOP_LEVEL_PROPERTY_NAME;
      }
      break;
      case TRACK: {
        mState = TRACK_PROPERTY_NAME;
      }
      break;
      case PLAYLIST: {
        mState = PLAYLIST_PROPERTY_NAME;
      }
      break;
      case PLAYLIST_ITEM: {
        mState = PLAYLIST_ITEM_NAME;
      }
      break;
      default: {
        // Nothing to do, leave state unchanged
      }
      break;
    }
  }
  else if (localName.EqualsLiteral("true") || localName.EqualsLiteral("false")) {
    // Handle boolean values which are just an element
    if (!mPropertyName.IsEmpty()) {
      mProperties->Set(mPropertyName, localName);
      // Pop the state back to it's base (ie from TRACK_PROPERTY_VALUE past
      // TRACK_PROPERTY_NAME to TRACK
      mState -= 2;
    }
  }
  else if (localName.EqualsLiteral("dict")) {
    // Based on the current state, figure out what type of collection we're in
    switch (mState) {
      case START: {
        mState = TOP_LEVEL_PROPERTIES;
      }
      break;
      case TRACKS: {
        mState = TRACKS_COLLECTION;
      }
      break;
      case TRACKS_COLLECTION: {
        mState = TRACK;
      }
      break;
      case PLAYLISTS_COLLECTION: {
        mState = PLAYLIST;
      }
      break;
      case PLAYLIST_ITEMS: {
        mState = PLAYLIST_ITEM;
      }
      break;
    }
  }
  else if (localName.EqualsLiteral("array")) {
    // If we're in the Playlists section, then enter the 
    // playlist collection state
    switch (mState) {
      case PLAYLISTS: {
         mState = PLAYLISTS_COLLECTION;
      }
      break;
    }
  }
  return NS_OK;
}

/* void endElement (in AString uri, in AString localName, in AString qName); */
NS_IMETHODIMP sbiTunesXMLParser::EndElement(const nsAString & uri,
                                            const nsAString & localName,
                                            const nsAString & qName) {
  LOG(("EndElement: URI=%s localName=%s qName=%s\n",
          NS_LossyConvertUTF16toASCII(uri).get(),
          NS_LossyConvertUTF16toASCII(localName).get(),
          NS_LossyConvertUTF16toASCII(qName).get()));
  // If we're ending a dict element (dictionary collection
  if (localName.EqualsLiteral("dict")) {
    // There's probably work to be done
    switch (mState) {
      case TRACKS: {  // Go back to the TOP_LEVEL_PROPERTIES state, 
                      // we're leaving the tracks section
        mState = TOP_LEVEL_PROPERTIES;
      }
      break;
      case TRACKS_COLLECTION: {  // We're leaving the tracks collection, 
                                 // so go back to the tracks section 
        mState = TRACKS;
        mListener->OnTracksComplete();
        // Process pending events before we return
        NS_ProcessPendingEvents(nsnull, 0);
      }
      break;
      case TRACK: {  // We're leaving a track so notify
                     // Then go back to track collection
        mState = TRACKS_COLLECTION;
        LOG(("onTrack\n"));
        mListener->OnTrack(mProperties);
        mProperties->Clear();
      }
      break;
      case PLAYLIST: {  // We're leaving a playlist so notify
                        // Then go back to the playlists collection
        mState = PLAYLISTS_COLLECTION;
        LOG(("onPlaylist\n"));
        mListener->OnPlaylist(mProperties, mTracks.Elements(), mTracks.Length());
        mTracks.Clear();
        mProperties->Clear();
      }
      break;
      case PLAYLIST_ITEM: {  // We're leaving a playlist item
                             // Go back to the playlist items
        mState = PLAYLIST_ITEMS;
      }
      break;
      case PLAYLISTS: {  // We're leaving the playlists section
                         // we're done
        mState = DONE;
      }
      break;
      default: {
        NS_WARNING("Unexpected state in sbiTunesXMLParser::EndElement (dict)");
      }
      break;
    }
  }
  // if We're leaving an array, see if it's the playlist's array of items
  // and if so, set the state back to the playlist.
  else if (localName.EqualsLiteral("array")) {
    switch (mState) {
      case PLAYLIST_ITEMS: {
        mState = PLAYLIST;
      }
      break;
      case PLAYLISTS_COLLECTION: {  // We're leaving the playlist collection                                
        mState = PLAYLISTS;        // go back to the playlists section
        mListener->OnPlaylistsComplete();
      }
      break;
      default: {
        NS_WARNING("Unexpected state in sbiTunesXMLParser::EndElement (array)");
      }
      break;
    }
  }
  return NS_OK;
}

/* void characters (in AString value); */
NS_IMETHODIMP sbiTunesXMLParser::Characters(const nsAString & value) {
  LOG(("Characters: %s\n", NS_LossyConvertUTF16toASCII(value).get()));
  switch (mState) {
    // Handle the property name. This is where the name string comes in
    case TOP_LEVEL_PROPERTY_NAME:
    case TRACK_PROPERTY_NAME:
    case PLAYLIST_PROPERTY_NAME:
    case PLAYLIST_ITEM_NAME:
    case TRACKS: {
      if (value.EqualsLiteral("Tracks")) {
        mState = TRACKS;
        mListener->OnTopLevelProperties(mProperties);
        mProperties->Clear();
      }
      else if (value.EqualsLiteral("Playlists")) {
        mState = PLAYLISTS;
      }
      else if (value.EqualsLiteral("Playlist Items")) {
        mState = PLAYLIST_ITEMS;
      }
      else {
         mPropertyName = value;
        ++mState;
      }
    }
    break;
    
    // The next case statements handle the values for the properties
    case TOP_LEVEL_PROPERTY_VALUE: {
      mState = TOP_LEVEL_PROPERTIES;
      if (!mPropertyName.IsEmpty()) {
        mProperties->Set(mPropertyName, value);
        mPropertyName.Truncate();
      }
    }
    break;
    case TRACK_PROPERTY_VALUE: {
      mState = TRACK;      
      if (!mPropertyName.IsEmpty()) {
        mProperties->Set(mPropertyName, value);
        mPropertyName.Truncate();
      }
    }
    break;
    case PLAYLIST_PROPERTY_VALUE: {
      mState = PLAYLIST;
      if (!mPropertyName.IsEmpty()) {
        mProperties->Set(mPropertyName, value);
        mPropertyName.Truncate();
      }
    }
    break;
    // Where we see the track ID
    case PLAYLIST_ITEM_VALUE: {
      mState = PLAYLIST_ITEM;
      if (!mPropertyName.IsEmpty()) {
        nsresult rv;
        PRInt32 const trackID = value.ToInteger(&rv, 10);
        PRInt32 const * newTrackID = mTracks.AppendElement(trackID);
        NS_ENSURE_TRUE(newTrackID, NS_ERROR_OUT_OF_MEMORY);
        mPropertyName.Truncate();
      }
    }
    break;
  }
  return NS_OK;
}

/* void processingInstruction (in AString target, in AString data); */
NS_IMETHODIMP sbiTunesXMLParser::ProcessingInstruction(const nsAString & target,
                                                       const nsAString & data) {
  // Ignore
  return NS_OK;
}

/* void ignorableWhitespace (in AString whitespace); */
NS_IMETHODIMP sbiTunesXMLParser::IgnorableWhitespace(const nsAString & whitespace) {
  // Ignore
  return NS_OK;
}

/* void startPrefixMapping (in AString prefix, in AString uri); */
NS_IMETHODIMP sbiTunesXMLParser::StartPrefixMapping(const nsAString & prefix,
                                                    const nsAString & uri) {
  // Ignore
  return NS_OK;
}

/* void endPrefixMapping (in AString prefix); */
NS_IMETHODIMP sbiTunesXMLParser::EndPrefixMapping(const nsAString & prefix) {
  // Ignore
  return NS_OK;
}

/* nsSAXErrorHandler */

/* void error (in nsISAXLocator locator, in AString error); */
NS_IMETHODIMP sbiTunesXMLParser::Error(nsISAXLocator *locator,
                                       const nsAString & error) {
  LogError("Error", locator, error);
  PRBool continueParsing = PR_FALSE;
  nsresult rv = mListener->OnError(BuildErrorMessage("Error", locator, error), &continueParsing);
  NS_ENSURE_SUCCESS(rv, rv);
  
  return continueParsing ? NS_OK : NS_ERROR_FAILURE;
}

/* void fatalError (in nsISAXLocator locator, in AString error); */
NS_IMETHODIMP sbiTunesXMLParser::FatalError(nsISAXLocator *locator,
                                            const nsAString & error) {
  LogError("Fatal error", locator, error);
  PRBool continueParsing = PR_FALSE;
  nsresult rv = mListener->OnError(BuildErrorMessage("Fatal error", locator, error), &continueParsing);
  NS_ENSURE_SUCCESS(rv, rv);
  
  return continueParsing ? NS_OK : NS_ERROR_FAILURE;
}

/* void ignorableWarning (in nsISAXLocator locator, in AString error); */
NS_IMETHODIMP sbiTunesXMLParser::IgnorableWarning(nsISAXLocator *locator,
                                                  const nsAString & error) {
  LogError("Warning", locator, error);
  PRBool continueParsing = PR_FALSE;
  nsresult rv = mListener->OnError(BuildErrorMessage("Warning", locator, error), &continueParsing);
  NS_ENSURE_SUCCESS(rv, rv);
  
  return continueParsing ? NS_OK : NS_ERROR_FAILURE;
}

nsresult sbiTunesXMLParser::InitializeProperties() {
  
  nsresult rv = NS_OK;
  if (!mProperties) {
    mProperties = do_CreateInstance(SB_STRINGMAP_CONTRACTID, &rv);
  }
  else {
    mProperties->Clear();
  }
  return rv;
}
