/* vim: fileencoding=utf-8 shiftwidth=2 */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is toolkit/components/systray
 *
 * The Initial Developer of the Original Code is
 * Mook <mook.moz+cvs.mozilla.org@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Brad Peterson <b_peterson@yahoo.com>
 *   Daniel Glazman <daniel.glazman@disruptive-innovations.com>
 *   Matthew Gertner <matthew@allpeers.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#ifndef nsSystemTrayServiceGTK_h__
#define nsSystemTrayServiceGTK_h__

#include "nsISystemTrayService.h"
#include <gtk/gtk.h>
#include "nsInterfaceHashtable.h"
#include "nsSystemTrayIconGTK.h"

class nsIURI;

class nsSystemTrayService : public nsISystemTrayService
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSISYSTEMTRAYSERVICE

  nsSystemTrayService();

private:
  ~nsSystemTrayService();

protected:
  nsInterfaceHashtable <nsStringHashKey, nsSystemTrayIconGTK> mIconDataMap;
};

#define NS_SYSTEMTRAYSERVICE_CONTRACTID \
  "@mozilla.org/system-tray-service;1"

#define NS_SYSTEMTRAYSERVICE_CLASSNAME "GTK System Tray Service"

// 1a2bca5e-c624-491c-af6e-23a19d7f7479
#define NS_SYSTEMTRAYSERVICE_CID \
  { 0x1a2bca5e, 0xc624, 0x491c, \
  { 0xaf, 0x6e, 0x23, 0xa1, 0x9d, 0x7f, 0x74, 0x79 } }

#endif /* nsSystemTrayServiceGTK_h__ */
