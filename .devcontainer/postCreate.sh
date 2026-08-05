#!/bin/bash
# Se corre UNA sola vez, cuando el Codespace se crea o se reconstruye desde
# cero (postCreateCommand). Deja MySQL instalado, el usuario de la app
# creado (usando el mismo DB_PASSWORD que ya vive como Codespaces secret,
# para que nunca haya que escribir la contraseña dos veces), los datos
# importados si ya subiste sicem_backup.sql, y los 6 servicios con sus
# dependencias listas. Arrancar MySQL en cada resume es cosa aparte
# (postStartCommand en devcontainer.json) porque los servicios de Linux no
# sobreviven la suspensión del contenedor aunque los archivos sí.
set -e

echo "== Instalando MySQL =="
sudo apt-get update -qq
sudo apt-get install -y mysql-server
sudo service mysql start

echo "== Configurando autenticación de root =="
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'root';" 2>/dev/null || true

echo "== Creando base de datos y usuario de la app =="
sudo mysql -uroot -proot -e "CREATE DATABASE IF NOT EXISTS sicem;"
sudo mysql -uroot -proot -e "CREATE USER IF NOT EXISTS 'sicem_app'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASSWORD:-changeme}';"
sudo mysql -uroot -proot -e "ALTER USER 'sicem_app'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASSWORD:-changeme}';"
sudo mysql -uroot -proot -e "GRANT ALL PRIVILEGES ON sicem.* TO 'sicem_app'@'localhost';"
sudo mysql -uroot -proot -e "FLUSH PRIVILEGES;"

BACKUP_FILE="$(find /workspaces -maxdepth 2 -iname "sicem_backup.sql" 2>/dev/null | head -1)"
if [ -n "$BACKUP_FILE" ]; then
  echo "== Importando datos desde $BACKUP_FILE =="
  sudo mysql -uroot -proot sicem < "$BACKUP_FILE"
  echo "Importación completa."
else
  echo "== No se encontró sicem_backup.sql en la raíz del repo =="
  echo "Súbelo (arrastra el archivo a la raíz en el explorador de VS Code) y luego corre:"
  echo "  sudo mysql -uroot -proot sicem < sicem_backup.sql"
fi

echo "== Escribiendo .env de puerto por servicio =="
declare -A PORTS=( [gateway]=3000 [services/usuarios]=3001 [services/hospitales]=3002 [services/unidades]=3003 [services/pacientes]=3004 [services/emergencias]=3005 )
for dir in "${!PORTS[@]}"; do
  echo "PORT=${PORTS[$dir]}" > "/workspaces/sicem/$dir/.env"
done

echo "== Instalando dependencias de los 6 servicios (puede tardar varios minutos) =="
for dir in gateway services/usuarios services/hospitales services/unidades services/pacientes services/emergencias; do
  echo "  -> $dir"
  (cd "/workspaces/sicem/$dir" && yarn install --silent)
done

echo "== Listo. Falta nada más que iniciar los 6 servicios con 'yarn dev' en cada uno. =="
