data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "symphony" {
  cidr_block           = "10.100.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = "symphony" }
}

resource "aws_internet_gateway" "symphony" {
  vpc_id = aws_vpc.symphony.id
  tags   = { Name = "symphony" }
}

resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.symphony.id
  availability_zone = data.aws_availability_zones.available.names[count.index]
  cidr_block        = cidrsubnet(aws_vpc.symphony.cidr_block, 8, count.index)
  tags              = { Name = "symphony-public-${count.index + 1}" }
}

resource "aws_subnet" "private" {
  vpc_id            = aws_vpc.symphony.id
  availability_zone = aws_subnet.public[0].availability_zone
  cidr_block        = cidrsubnet(aws_vpc.symphony.cidr_block, 8, 10)
  tags              = { Name = "symphony-private" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.symphony.id
  tags   = { Name = "symphony-public" }
}

resource "aws_route" "public_outbound" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.symphony.id
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "symphony-nat" }
}

resource "aws_nat_gateway" "symphony" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  tags          = { Name = "symphony" }
  depends_on    = [aws_internet_gateway.symphony, aws_route.public_outbound]
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.symphony.id
  tags   = { Name = "symphony-private" }
}

resource "aws_route" "private_outbound" {
  route_table_id         = aws_route_table.private.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.symphony.id
}

resource "aws_route_table_association" "private" {
  subnet_id      = aws_subnet.private.id
  route_table_id = aws_route_table.private.id
}
