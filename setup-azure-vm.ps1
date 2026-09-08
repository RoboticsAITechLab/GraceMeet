$ErrorActionPreference = "Stop"
$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
$rg = "gracemeet-rg"
$nsg = "gracemeet-nsg"
$location = "centralindia"
$dnsPrefix = "gracemeet-sfu-" + (Get-Random -Minimum 10000 -Maximum 99999)

Write-Host "Creating NSG rules..."
& $az network nsg rule create -g $rg --nsg-name $nsg -n Allow-SSH --priority 100 --direction Inbound --access Allow --protocol Tcp --destination-port-ranges 22 --output none
& $az network nsg rule create -g $rg --nsg-name $nsg -n Allow-HTTP --priority 110 --direction Inbound --access Allow --protocol Tcp --destination-port-ranges 80 --output none
& $az network nsg rule create -g $rg --nsg-name $nsg -n Allow-HTTPS-WSS --priority 120 --direction Inbound --access Allow --protocol Tcp --destination-port-ranges 443 --output none
& $az network nsg rule create -g $rg --nsg-name $nsg -n Allow-LiveKit-Signal --priority 130 --direction Inbound --access Allow --protocol Tcp --destination-port-ranges 7880 --output none
& $az network nsg rule create -g $rg --nsg-name $nsg -n Allow-LiveKit-TCP --priority 140 --direction Inbound --access Allow --protocol Tcp --destination-port-ranges 7881 --output none
& $az network nsg rule create -g $rg --nsg-name $nsg -n Allow-LiveKit-UDP-Primary --priority 150 --direction Inbound --access Allow --protocol Udp --destination-port-ranges 7882 --output none
& $az network nsg rule create -g $rg --nsg-name $nsg -n Allow-LiveKit-UDP-Range --priority 160 --direction Inbound --access Allow --protocol Udp --destination-port-ranges 50000-60000 --output none

Write-Host "Creating Virtual Network & Subnet..."
& $az network vnet create -g $rg -n gracemeet-vnet --subnet-name gracemeet-subnet --location $location --output none

Write-Host "Creating Static Public IP with DNS name: $dnsPrefix..."
& $az network public-ip create -g $rg -n gracemeet-ip --dns-name $dnsPrefix --allocation-method Static --sku Standard --location $location --output none

Write-Host "Creating Network Interface (NIC)..."
& $az network nic create -g $rg -n gracemeet-nic --vnet-name gracemeet-vnet --subnet-name gracemeet-subnet --network-security-group $nsg --public-ip-address gracemeet-ip --location $location --output none

Write-Host "Creating Ubuntu 22.04 VM (Standard_B2s)..."
& $az vm create `
  -g $rg `
  -n gracemeet-sfu-vm `
  --nics gracemeet-nic `
  --image Ubuntu2204 `
  --size Standard_B2s `
  --admin-username azureuser `
  --generate-ssh-keys `
  --location $location

Write-Host "VM Creation Finished! Fetching details..."
$ipInfo = & $az network public-ip show -g $rg -n gracemeet-ip --query "{ip:ipAddress, fqdn:dnsSettings.fqdn}" -o json | ConvertFrom-Json
Write-Host "Public IP: $($ipInfo.ip)"
Write-Host "FQDN: $($ipInfo.fqdn)"
