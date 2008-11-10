/*
//
// BEGIN SONGBIRD GPL
// 
// This file is part of the Songbird web player.
//
// Copyright(c) 2005-2008 POTI, Inc.
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

/** 
 * \file  sbBaseMediacoreVolumeControl.h
 * \brief Songbird Mediacore Event Definition.
 */

#ifndef __SB_BASEMEDIACOREVOLUMECONTROL_H__
#define __SB_BASEMEDIACOREVOLUMECONTROL_H__

#include <sbIMediacoreVolumeControl.h>

#include <nsAutoLock.h>
#include <nsCOMPtr.h>

class sbBaseMediacoreVolumeControl : public sbIMediacoreVolumeControl
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_SBIMEDIACOREVOLUMECONTROL

  sbBaseMediacoreVolumeControl();

  nsresult InitBaseMediacoreVolumeControl();

  // Override me, look in the cpp file for implementation notes.
  virtual nsresult OnInitBaseMediacoreVolumeControl();

  // Override me, look in the cpp file for implementation notes;
  virtual nsresult OnSetMute(PRBool aMute);

  // Override me, look in the cpp file for implementation notes.
  virtual nsresult OnSetVolume(PRFloat64 aVolume);

protected:
  virtual ~sbBaseMediacoreVolumeControl();

  PRMonitor *mMonitor;

  PRBool  mMute;
  double  mVolume;
};

#endif /* __SB_BASEMEDIACOREVOLUMECONTROL_H__ */
