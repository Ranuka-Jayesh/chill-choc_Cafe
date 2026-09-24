$p = Get-Printer -Name "XP-80C"
Write-Host "Printer Name:" $p.Name
$papers = (Get-PrintConfiguration -PrinterName "XP-80C").PrintTicketXML
Write-Host $papers
