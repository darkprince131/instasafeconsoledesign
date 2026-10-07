/**
 * Device catalogues, read off the captured production forms.
 *
 * The device screens in this console had invented columns until now. These
 * are the real field sets:
 *
 *   /devices          Name · Mac Address · OS · Serial Number · UUID · Registered On · Status
 *                     add: profile_name, device_os, device_mac_address, device_serial_no, uuid
 *   /device-checks    Rule Name · OS · Check · Check Value
 *                     add: rule_name, os_id, check, check_value
 *   /device-policy    Name · OS · Type · Status
 *   /device-updates   Name · Filename · Arguments · Status
 *                     add: profile_name, file_name, arguments, status,
 *                          installation_schedule, installation_validation, checkvalue
 *   /app-blocker      Name · OS · AppName          add: profile_name, device_os, app_name
 *   /geo-fences       Name · Latitude · Longitude · Fence Radius (metres)
 *                     add: profile_name, latitude, longitude, distance
 *   /auth-devices     UserName · Phone · Registered On   — list only, no Add
 */

/** The 25 check types, exactly as the captured <select#check> lists them. */
export const DEVICE_CHECKS = [
  'AntiSpyWare', 'AntiSpywareStatus', 'Antivirus', 'AntiVirusLastUpdate',
  'AntiVirusStatus', 'BitLocker', 'BrowserID', 'DomainName', 'FileExists',
  'FileNotExists', 'Firewall', 'FirewallStatus', 'Hotfix', 'HotFix',
  'InDomain', 'mdm', 'OS', 'OSName', 'OS Version', 'ProcessNotRunning',
  'ProcessRunning', 'RegistryKeyExists', 'SEPLastAVUpdate', 'ServicePack',
  'TenantId'
]

/**
 * What the Check Value means for each check, and a realistic example.
 *
 * The production form labels this field "Check value" for all 25 types and
 * offers no guidance whatsoever, which is why it is the field most likely to
 * be filled in wrongly. The hints are ours; the check names are theirs.
 */
export const CHECK_VALUE_HELP = {
  AntiSpyWare:          ['Product name', 'Windows Defender'],
  AntiSpywareStatus:    ['Expected status', 'Enabled'],
  Antivirus:            ['Product name', 'CrowdStrike Falcon'],
  AntiVirusLastUpdate:  ['Maximum age in days', '7'],
  AntiVirusStatus:      ['Expected status', 'Enabled'],
  BitLocker:            ['Expected state', 'Enabled'],
  BrowserID:            ['Browser identifier', 'Chrome'],
  DomainName:           ['Domain the device must be joined to', 'corp.example.com'],
  FileExists:           ['Full path that must exist', 'C:\\Program Files\\Agent\\agent.exe'],
  FileNotExists:        ['Full path that must NOT exist', 'C:\\Users\\Public\\tool.exe'],
  Firewall:             ['Product name', 'Windows Firewall'],
  FirewallStatus:       ['Expected status', 'Enabled'],
  Hotfix:               ['KB number', 'KB5034441'],
  HotFix:               ['KB number', 'KB5034441'],
  InDomain:             ['Expected value', 'true'],
  mdm:                  ['MDM provider', 'Intune'],
  OS:                   ['Operating system', 'Microsoft Windows'],
  OSName:               ['Exact OS name', 'Microsoft Windows 11 Pro'],
  'OS Version':         ['Minimum version', '10.0.22631'],
  ProcessNotRunning:    ['Process that must NOT be running', 'tor.exe'],
  ProcessRunning:       ['Process that must be running', 'CSFalconService.exe'],
  RegistryKeyExists:    ['Registry path', 'HKLM\\SOFTWARE\\Corp\\Managed'],
  SEPLastAVUpdate:      ['Maximum age in days', '3'],
  ServicePack:          ['Service pack level', 'SP1'],
  TenantId:             ['Tenant identifier', 'veno']
}

/** Blocked apps only offers these two, per the captured select. */
export const BLOCKED_APP_OS = ['Microsoft Windows', 'Mac OS']

export const UPDATE_STATUS = ['Enabled', 'Disabled']
export const UPDATE_SCHEDULE = ['Immediate', 'After-Reboot', 'Uninstall']
export const UPDATE_VALIDATION = ['Registry Key present', 'File present']

/**
 * The OS list.
 *
 * Production ships 2,393 options in this one select — of which 1,918 are
 * individual Android handset models ("Android 10 Acer One 8 T4 82L"). That is
 * not a list anybody can use: it is a device inventory that escaped into a
 * dropdown.
 *
 * What follows is a representative set drawn from the real one, grouped by
 * family, which is how the field should have worked in the first place. The
 * full list is in the capture if it is ever needed verbatim.
 */
export const OS_FAMILIES = {
  Windows: ['Microsoft Windows', 'Microsoft Windows 10', 'Microsoft Windows 11',
            'Microsoft Windows Server 2019', 'Microsoft Windows Server 2022'],
  macOS:   ['macOS', 'MacOSX 13', 'MacOSX 14', 'MacOSX 15'],
  Linux:   ['Linux', 'Ubuntu', 'Ubuntu 22.04', 'Ubuntu 24.04', 'Debian', 'Fedora',
            'CentOS', 'Red Hat Enterprise Linux', 'AlmaLinux', 'LinuxMint', 'Amazon Linux 2023'],
  Android: ['Android', 'Android 13', 'Android 14', 'Android 15'],
  iOS:     ['iOS', 'iOS 17', 'iOS 18', 'iPadOS', 'iPadOS 18']
}

export const OS_LIST = Object.values(OS_FAMILIES).flat()
