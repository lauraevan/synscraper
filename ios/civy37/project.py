"""Register Civy 3.7 Search, Live and Reels with the existing Xcode app target."""
from pathlib import Path
import sys
root=Path(sys.argv[1]); project=root/'Civy.xcodeproj/project.pbxproj'
s=project.read_text()
added='''\t\tB51F8A63D7B14C72AB9A3E10 /* PBXFileReference */ = {
\t\t\tisa = PBXFileReference;
\t\t\tlastKnownFileType = "sourcecode.swift";
\t\t\tpath = "CivyReels.swift";
\t\t\tsourceTree = "<group>";
\t\t};
\t\tB51F8A63D7B14C72AB9A3E11 /* PBXBuildFile */ = {
\t\t\tisa = PBXBuildFile;
\t\t\tfileRef = "B51F8A63D7B14C72AB9A3E10";
\t\t};
\t\tB51F8A63D7B14C72AB9A3E12 /* PBXFileReference */ = {
\t\t\tisa = PBXFileReference;
\t\t\tlastKnownFileType = "sourcecode.swift";
\t\t\tpath = "CivyLive.swift";
\t\t\tsourceTree = "<group>";
\t\t};
\t\tB51F8A63D7B14C72AB9A3E13 /* PBXBuildFile */ = {
\t\t\tisa = PBXBuildFile;
\t\t\tfileRef = "B51F8A63D7B14C72AB9A3E12";
\t\t};
'''
needle='\t\t9F6CFF8906F1A9A5F87CD18B /* PBXFileReference */ = {'
assert needle in s
s=s.replace(needle,added+needle,1)
a='68206999538D4E6386F6861F, 4DB5DC12'
b='68206999538D4E6386F6861F, B51F8A63D7B14C72AB9A3E10, B51F8A63D7B14C72AB9A3E12, 4DB5DC12'
assert a in s
s=s.replace(a,b,1)
a='88D1C52B8F78F686DF936881, 5B387801'
b='88D1C52B8F78F686DF936881, B51F8A63D7B14C72AB9A3E11, B51F8A63D7B14C72AB9A3E13, 5B387801'
assert a in s
s=s.replace(a,b,1)
assert s.count('MARKETING_VERSION = "3.6.0";') == 2
s=s.replace('MARKETING_VERSION = "3.6.0";', 'MARKETING_VERSION = "3.7.0";')
s=s.replace('CURRENT_PROJECT_VERSION = "5";', 'CURRENT_PROJECT_VERSION = "6";')
assert s.count('INFOPLIST_KEY_CFBundleDisplayName = "Civy Beta";') == 2
project.write_text(s)
assert (root/'Civy/CivyReels.swift').exists() and (root/'Civy/CivyLive.swift').exists()
print('Civy 3.7 Xcode target registered, Beta version 3.7.0, build 6')