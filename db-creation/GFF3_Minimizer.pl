##Get Files to proccess in and out
use Data::Dumper;
use List::Util qw( min max );

my ($inFile,$outFile,$chrFile)= @ARGV;
my %genes ={};
my $numLines=0;

##hardcode these for now
$inFile ="/data/human/NCBI/ref_GRCh38.p12_top_level.gff3";
$outFile="NCBI_Min.gff3";
$chrFile="/data/human/NCBI/chr_accessions_GRCh38.p12";

unless($inFile=~/.gff3$/){
  print "Input file must be a gff3 file.\n";
  die;
}



my @topLevelFeats = ("pseudogene", "gene", "miRNA");
my %topLevelFeats = map { $_ => 1 } @topLevelFeats;
my %GENES;
my %isFeatOf;
my %ignoredFeats;
my %chrLookup;
my $feats_processed=0;

open(DATA, "<$inFile") or die "Can't open $inFile\n";
open(OUT, ">$outFile") or die "Cant open $outFile\n";
open(CHRFILE,"<$chrFile") or die "Cant open $chrfile\n";

print OUT "##gff-version 3\n";

if($chrFile){
  while (my $line = <CHRFILE>){
    chomp $line;
    if($line=~/^#/){
      ##Skip comments and headers
      next;
    }
    my @parts = split('\t', $line);
    my $chr = $parts[0];
    my $id = $parts[1];
    $chrLookup{$id}=$chr;
  }
}

print "Opening $inFile for reading and $outFile for output\n";

while( my $line = <DATA>){
	chomp $line;
	$numLines ++;

  if($line=~/^#/){
    ##Skip comments and headers
    next;
  }
  my @parts = split('\t', $line);

  ##Split out tabbed columns
  my @parts = split('\t', $line);
	my $chr = $parts[0];
  my $source =$parts[1];
	my $type =$parts[2];
	my $start = $parts[3];
	my $end =$parts[4];
	my $score = $parts[5];
	my $strand = $parts[6];
	my $phase =$parts[7];
	my $col9 =$parts[8];

  if($chrLookup{$chr}){
    $chr=$chrLookup{$chr};
  }



  ##Parse Col9 Regions
  my @col9_parts=split(';', $col9);
  my %col9_parts;
  foreach my $col9_part(@col9_parts){

    ##is this code inneficent?
    ##YES!
    ##if($col9_part=~/(?<field>.*)=(?<value>.*)/){
    ##  $col9_parts{$+{field}}=$+{value};
    ##}
    ##else{
    ##  print "Failed to parse col9 at $col9_part\n";
    ##  die;
    ##}
    my ($field,$value) = split("=",$col9_part);
    $col9_parts{$field}=$value;
  }



  ##SubFeatures
  if (exists $col9_parts{'Parent'}){
    #print "Feat $type is not a top level feature\n";
    my $parent_id=$col9_parts{'Parent'};
    my $sub_id=$col9_parts{'ID'};



    ##If this subfeature is a subfeature of another subfeature
    ##We need to add it to the hash but remove the middle "transcript" level feature

    if (exists $isFeatOf{$parent_id}){
      $isFeatOf{$sub_id}=$parent_id;
      my $top=0;
      while ($top == 0){
        $parent_id = $isFeatOf{$parent_id};
        if (exists $isFeatOf{$parent_id}){
          $top = 0;
        }
        else{ $top = 1;}
      }##While top is not true

      delete($GENES{"subfeatures"}{$col9_parts{'Parent'}});
      $GENES{"subfeatures"}{$sub_id}{'start'}=$start;
      $GENES{"subfeatures"}{$sub_id}{'end'}=$end;
    }#if exists a referenced feature...
    else{
      $isFeatOf{$sub_id}=$parent_id;
      $GENES{"subfeatures"}{$sub_id}{'start'}=$start;
      $GENES{"subfeatures"}{$sub_id}{'end'}=$end;
    }

  }##if exists Parent ID
  ##Top Level Features
  else{

    ##Check to see if we ignore this feat
    unless(exists $topLevelFeats{$type}){
      $ignoredFeats{$type}=1;
      next;
    }

    do_processing();

    my $gene_id=$col9_parts{'ID'};
    $GENES{"ID"}=$gene_id;
    $GENES{"name"}=$col9_parts{'Name'};
    $GENES{"type"}=$type;
    $GENES{"chr"}=$chr;
    $GENES{"start"}=$start;
    $GENES{"end"}=$end;
    $GENES{"strand"}=$strand;
    $GENES{"source"}=$source;
    #print "Feat type $type is a top level feature\n";
    #print "Feat name is ".$col9_parts{'Name'}."\n";
    unless (exists $col9_parts{'Name'}){
      print "NO NAME $type\n";
      print Dumper %GENES;
      die;
    }
    ##TEST CODE TEST CODE###
    if ($feats_processed % 1000 == 0){
      print "Features processed $feats_processed\n";
    }
    $feats_processed++;
    ##########################
  }





  undef $line, @parts ,$chr, $source, $type, $start, $end, $score, $strand, $phase, $col9, %col9_parts;
}##End While Data

foreach $key (keys %ignoredFeats){
  print "Feat $key was ignored\n";
}


close DATA;
close OUT;

##Methods

sub do_processing(){

  ##Ignore empty lines
  unless($GENES{"ID"}){
    %GENES={};
    %isFeatOf={};
    return;
  }



  my $id = $GENES{"ID"};
  my $chr = $GENES{"chr"};
  my $source = $GENES{"source"};
  my $type = $GENES{"type"};
  my $start = $GENES{"start"};
  my $end = $GENES{"end"};
  my $name = $GENES{"name"};
  my $strand = $GENES{"strand"};
  my $exon_start=0;
  my $exon_end=0;
  my $exon_number=1;
  my $has_exons=0;

  print OUT "$chr\t$source\t$type\t$start\t$end\t.\t$strand\t.\tID=$id;Name=$name\n";



  for my $sub_id (sort {$GENES{"subfeatures"}{$a}{"start"} <=> $GENES{"subfeatures"}{$b}{"start"}} keys %{$GENES{"subfeatures"}}){
    $has_exons=1;
    my $substart = $GENES{"subfeatures"}{$sub_id}{'start'};
    my $subend = $GENES{"subfeatures"}{$sub_id}{'end'};

    ##if starting a new exon.
    if($exon_start==0){
      #print "first exon\n";
      $exon_start=$substart;
      $exon_end=$subend;
    }
    elsif($substart==$exon_start){
      #print "same starts\n";
      $exon_end = max($subend, $exon_end);
    }
    #if overlap...
    elsif($substart<=$exon_end){
      #print "combined\n";
      $exon_end=$subend;
    }
    else{
      #print "$exon_start $exon_end $sub_id\n";
      print OUT "$chr\t$source\texon\t$exon_start\t$exon_end\t.\t$strand\t.\tID=exon$exon_number\_$id;Parent=$id\n";
      $exon_start=$substart;
      $exon_end=$subend;
      $exon_number++;
    }

    undef $substart, $subend;
  }

  ##If a feature has no exons... ADD ONE!
  unless($has_exons){
    print OUT "$chr\t$source\texon\t$start\t$end\t.\t$strand\t.\tID=exon1\_$id;Parent=$id\n";
  }

  ##if there is one more exon to print
  unless ($exon_start == 0){
    #print "$exon_start $exon_end $sub_id\n";
    print OUT "$chr\t$source\texon\t$exon_start\t$exon_end\t.\t$strand\t.\tID=exon$exon_number\_$id;Parent=$id\n";
  }

  #Clear Hashes
  %GENES={};
  %isFeatOf={};
  undef $id, $chr, $source, $type, $start, $end, $name;
  print OUT "###\n";
}
