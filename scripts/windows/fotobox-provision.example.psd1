# Configuration for provision-fotobox.ps1. Copy to fotobox-provision.psd1
# next to the script and adjust. Remove or comment out what you don't need.
@{
    # --- Windows ------------------------------------------------------------
    ComputerName     = 'FOTOBOX'
    TimeZone         = 'W. Europe Standard Time'   # Get-TimeZone -ListAvailable

    # Windows account the booth runs as (created if missing, signs in
    # automatically). Operators use their own administrator account.
    KioskUser        = 'Fotobox'

    # Tablet mode: 'none' (default), 'auto' (generate a token) or a token.
    LanToken         = 'none'

    # Optional: Wi-Fi the booth connects to automatically (WPA2/WPA3-Personal).
    # Wifi = @{ Ssid = 'Fotobox-WLAN'; Password = 'secret' }

    # Optional: printer driver package (.inf), relative to this folder.
    # PrinterDriverInf = 'drivers\selphy\cnbsl.inf'

    # --- Folders (created and made writable for the kiosk user) -------------
    Directories      = @{
        Photos   = 'C:\Fotobox\Fotos'
        # Own collage templates; leave out to use the built-in ones.
        # Collages = 'C:\Fotobox\Collagen'
    }

    # --- Fotobox settings ---------------------------------------------------
    # Applied when the app starts; applied again whenever this file is
    # provisioned with other values. Changes made in the app are kept until
    # then. Keys as on the settings page.
    Settings         = @{
        camera                = 'sony'          # sony, gphoto2, webcam, demo
        shutterTimeout        = 5               # countdown in seconds
        layouts               = @('Einzelbild', '2x2')
        usePrinter            = $true
        printerName           = 'Canon SELPHY CP1500'
        showPrintDialog       = $false
        useShare              = $false
        shareTokenExpiryHours = 24
        showGalleryButton     = $true
        galleryPassword       = '1234'          # 4 digits, '' = no PIN
        operatorPin           = '0000'          # 4 digits, '' = no PIN
        autoStart             = $true           # open the booth directly
    }
}
