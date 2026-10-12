@echo off
rem Is file par double-click karo. Ye inbox ke papers ko sahi folders mein bhej deti hai.
cd /d "%~dp0"
where py >nul 2>nul && (py organize.py) || (python organize.py)
echo.
echo Agar upar OK likha hai to kaam ho gaya. Ab website mein Ctrl+F5 dabao.
pause
