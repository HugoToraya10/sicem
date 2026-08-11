#!/bin/bash
# Arranca MariaDB en cada resume del Codespace.
# Debian 12 instala mariadb-server con unidad de systemd, sin script en
# /etc/init.d — como el contenedor no corre systemd, "service mariadb
# start" nunca funciona aquí. Por eso se levanta mysqld_safe directo,
# y solo si no está ya corriendo.
if ! pgrep -x mariadbd > /dev/null; then
  sudo mkdir -p /run/mysqld
  sudo chown mysql:mysql /run/mysqld
  sudo nohup mysqld_safe --skip-syslog > /tmp/mariadb.log 2>&1 &
  disown
  for i in $(seq 1 15); do
    sudo mysqladmin ping --silent 2>/dev/null && break
    sleep 1
  done
fi
