FK SAVA V6.1 — PWA INSTALL FIX

NOVO:
- javna FK Sava strana dobija svoj PWA manifest
- admin i javni sajt registruju zajednicki service worker
- oba mogu da se instaliraju kao zasebne aplikacije na Androidu
- javni app: FK Sava
- admin app: FK Sava Admin
- maskable ikone imaju tamnu pozadinu zbog Android adaptive-icon pravila
- obican favicon i any ikone ostaju transparentni

NAPOMENA:
Android launcher moze da maskira/adaptira ikonu. Potpuno transparentna spoljasnja pozadina nije garantovana za instaliranu PWA ikonu. Zato maskable varijanta koristi #08090a umesto bele pozadine.
