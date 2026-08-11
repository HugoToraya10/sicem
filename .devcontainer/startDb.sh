#!/bin/bash
if pgrep -x mariadbd > /dev/null; then
  echo "✓ MariaDB ya está corriendo."
else
  echo "Arrancando MariaDB..."
  sudo mkdir -p /run/mysqld
  sudo chown mysql:mysql /run/mysqld
  sudo nohup mysqld_safe --skip-syslog > /tmp/mariadb.log 2>&1 &
  disown
  for i in $(seq 1 15); do
    if sudo mysqladmin ping --silent 2>/dev/null; then
      echo "✓ MariaDB arrancó correctamente."
      break
    fi
    sleep 1
  done
fi
